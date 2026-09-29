import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/contract.d";
import contractJson from "../prisma/contract.json" with { type: "json" };

type Condicion = Record<string, any>;
type DatosFila = any;

type ArgumentosConsulta = {
  where?: Condicion;
  orderBy?: Condicion | Condicion[];
  select?: Record<string, boolean>;
  include?: unknown;
};

type ArgumentosModificar = {
  where: Condicion;
  data: Condicion;
};

type Modelo = {
  findFirst: (args?: ArgumentosConsulta) => Promise<DatosFila | null>;
  findUnique: (args?: ArgumentosConsulta) => Promise<DatosFila | null>;
  findMany: (args?: ArgumentosConsulta) => Promise<DatosFila[]>;
  create: (args: { data: Condicion }) => Promise<DatosFila>;
  update: (args: ArgumentosModificar) => Promise<DatosFila | null>;
  updateMany: (args: ArgumentosModificar) => Promise<{ count: number }>;
  count: (args?: { where?: Condicion }) => Promise<number>;
};

type ClienteContrato = {
  orm: unknown;
  sql: unknown;
  raw: unknown;
  connect: () => Promise<unknown>;
  close: () => Promise<void>;
};

const clienteContrato = postgres<Contract>({
  contractJson,
  url: process.env["DATABASE_URL"]!,
}) as unknown as ClienteContrato;

let conexionAbierta: Promise<unknown> | null = null;

function asegurarConexion() {
  if (!conexionAbierta) {
    conexionAbierta = clienteContrato.connect().catch((error) => {
      conexionAbierta = null;
      throw error;
    });
  }
  return conexionAbierta;
}

function esObjeto(valor: unknown): valor is Condicion {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor) &&
    !(valor instanceof Date)
  );
}

type InstantTemporal = { epochNanoseconds: bigint };

function esInstant(valor: unknown): valor is InstantTemporal {
  return (
    typeof valor === "object" &&
    valor !== null &&
    "epochNanoseconds" in valor &&
    typeof (valor as InstantTemporal).epochNanoseconds === "bigint"
  );
}

const globalTemporal = (
  globalThis as {
    Temporal?: {
      Instant: { fromEpochMilliseconds: (milisegundos: number) => unknown };
    };
  }
).Temporal;

function normalizarValor(valor: unknown): unknown {
  if (esInstant(valor)) {
    return new Date(Number(valor.epochNanoseconds / 1_000_000n));
  }
  if (Array.isArray(valor)) return valor.map(normalizarValor);
  if (esObjeto(valor)) {
    const copia: Condicion = {};
    for (const [campo, contenido] of Object.entries(valor)) {
      copia[campo] = normalizarValor(contenido);
    }
    return copia;
  }
  return valor;
}

function paraLaBase(valor: unknown): unknown {
  if (!(valor instanceof Date) || !globalTemporal) return valor;
  return globalTemporal.Instant.fromEpochMilliseconds(valor.getTime());
}

function esIncremento(valor: unknown): valor is { increment: number } {
  return esObjeto(valor) && typeof valor.increment === "number";
}

function coincideValor(actual: unknown, esperado: unknown): boolean {
  if (esperado === null || esperado === undefined) {
    return actual === null || actual === undefined;
  }
  if (actual === esperado) return true;
  return String(actual) === String(esperado);
}

function coincideCampo(fila: DatosFila, campo: string, esperado: unknown): boolean {
  const actual = fila[campo];
  if (esObjeto(esperado)) {
    if (Array.isArray(esperado.in)) {
      return esperado.in.some((valor: unknown) => coincideValor(actual, valor));
    }
    if ("equals" in esperado) return coincideValor(actual, esperado.equals);
    if ("not" in esperado) return !coincideValor(actual, esperado.not);
  }
  return coincideValor(actual, esperado);
}

function coincideCondicion(fila: DatosFila, where?: Condicion): boolean {
  return Object.entries(where ?? {}).every(([campo, esperado]) =>
    coincideCampo(fila, campo, esperado),
  );
}

function dividirCondicion(where?: Condicion) {
  const condicionSimple: Condicion = {};
  let requiereRevision = false;

  for (const [campo, valor] of Object.entries(where ?? {})) {
    if (valor === null || valor === undefined || esObjeto(valor)) {
      requiereRevision = true;
      continue;
    }
    condicionSimple[campo] = paraLaBase(valor);
  }

  return { condicionSimple, requiereRevision };
}

function comparable(valor: unknown): any {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "object" && valor !== null) {
    if ("epochNanoseconds" in valor) return valor.epochNanoseconds;
    const serializado = (valor as Condicion).toJSON?.();
    if (
      typeof serializado === "string" ||
      typeof serializado === "number" ||
      typeof serializado === "bigint"
    ) {
      return serializado;
    }
  }
  return valor;
}

function ordenarFilas(
  filas: DatosFila[],
  orderBy?: ArgumentosConsulta["orderBy"],
): DatosFila[] {
  if (!orderBy) return filas;

  const criterios = Array.isArray(orderBy) ? orderBy : [orderBy];

  return [...filas].sort((a, b) => {
    for (const criterio of criterios) {
      const entrada = Object.entries(criterio)[0];
      if (!entrada) continue;
      const [campo, direccion] = entrada as [string, string];
      const valorA = comparable(a[campo]);
      const valorB = comparable(b[campo]);
      if (valorA === valorB) continue;
      const sentido = direccion === "desc" ? -1 : 1;
      return (valorA > valorB ? 1 : -1) * sentido;
    }
    return 0;
  });
}

function proyectarFila(
  fila: DatosFila,
  select?: Record<string, boolean>,
): DatosFila {
  if (!select) return fila;
  const proyeccion: DatosFila = {};
  for (const [campo, visible] of Object.entries(select)) {
    if (visible) proyeccion[campo] = fila[campo];
  }
  return proyeccion;
}

async function consultar(modelo: any, args: ArgumentosConsulta) {
  await asegurarConexion();

  const { condicionSimple, requiereRevision } = dividirCondicion(args.where);
  const consulta =
    Object.keys(condicionSimple).length > 0
      ? modelo.where(condicionSimple)
      : modelo;

  let filas: DatosFila[] = (await consulta.all()).map(
    (fila: DatosFila) => normalizarValor(fila) as DatosFila,
  );

  if (requiereRevision) {
    filas = filas.filter((fila) => coincideCondicion(fila, args.where));
  }

  const filasOrdenadas = ordenarFilas(filas, args.orderBy);

  return filasOrdenadas.map((fila) => proyectarFila(fila, args.select));
}

function datosLimpios(data: Condicion): Condicion {
  const limpios: Condicion = {};
  for (const [campo, valor] of Object.entries(data)) {
    if (valor === undefined || esIncremento(valor)) continue;
    limpios[campo] = paraLaBase(valor);
  }
  return limpios;
}

function datosConIncrementos(fila: DatosFila, data: Condicion): Condicion {
  const resueltos = datosLimpios(data);
  for (const [campo, valor] of Object.entries(data)) {
    if (esIncremento(valor)) {
      resueltos[campo] = Number(fila[campo] ?? 0) + valor.increment;
    }
  }
  return resueltos;
}

function crearModelo(modelo: any): Modelo {
  function clasificar(args: ArgumentosModificar) {
    const { condicionSimple, requiereRevision } = dividirCondicion(args.where);
    const hayIncrementos = Object.values(args.data).some(esIncremento);
    const hayObjetivo = Object.keys(condicionSimple).length > 0;

    if (!hayObjetivo && !requiereRevision) return "sin-objetivo" as const;
    if (!requiereRevision && !hayIncrementos) return "directa" as const;
    return "por-fila" as const;
  }

  async function aplicarPorFila(args: ArgumentosModificar): Promise<DatosFila[]> {
    const filas = await consultar(modelo, { where: args.where });

    for (const fila of filas) {
      await modelo
        .where({ id: fila.id })
        .update(datosConIncrementos(fila, args.data));
    }

    return filas;
  }

  return {
    async findFirst(args = {}) {
      const filas = await consultar(modelo, args);
      return filas[0] ?? null;
    },

    async findUnique(args = {}) {
      const filas = await consultar(modelo, args);
      return filas[0] ?? null;
    },

    async findMany(args = {}) {
      return consultar(modelo, args);
    },

    async create({ data }) {
      await asegurarConexion();
      return normalizarValor(await modelo.create(datosLimpios(data))) as DatosFila;
    },

    async update(args) {
      await asegurarConexion();
      const ruta = clasificar(args);

      if (ruta === "sin-objetivo") return null;
      if (ruta === "directa") {
        const { condicionSimple } = dividirCondicion(args.where);
        const modificada = await modelo
          .where(condicionSimple)
          .update(datosLimpios(args.data));
        return normalizarValor(modificada) as DatosFila;
      }

      const filas = await aplicarPorFila(args);
      return filas[0] ?? null;
    },

    async updateMany(args) {
      await asegurarConexion();
      const ruta = clasificar(args);

      if (ruta === "sin-objetivo") return { count: 0 };
      if (ruta === "directa") {
        const { condicionSimple } = dividirCondicion(args.where);
        const afectadas = await consultar(modelo, { where: args.where });
        await modelo.where(condicionSimple).updateAll(datosLimpios(args.data));
        return { count: afectadas.length };
      }

      const filas = await aplicarPorFila(args);
      return { count: filas.length };
    },

    async count(args = {}) {
      const filas = await consultar(modelo, args);
      return filas.length;
    },
  };
}

const modelos: Record<string, Modelo> = {};

for (const nombreModelo of Object.keys(
  (contractJson as unknown as { roots: Record<string, unknown> }).roots,
)) {
  modelos[nombreModelo] = crearModelo(
    (clienteContrato as any).orm.public[nombreModelo],
  );
}

const clientePrisma = Object.assign(
  Object.create(clienteContrato),
  modelos,
) as ClienteContrato & {
  usuario: Modelo;
  venta: Modelo;
  cola: Modelo;
  reporte: Modelo;
};

export default clientePrisma;
