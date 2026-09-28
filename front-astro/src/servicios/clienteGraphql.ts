const URL_SERVICIO_GRAPHQL = "http://localhost:5000/graphql";

export type ProductoCatalogo = {
  id: string;
  nombre: string;
  precio: number;
  imagenes: string[];
  categoria: string;
};

type RespuestaGraphQL<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type DatosProductos = {
  productos: ProductoCatalogo[];
};

const consultaProductos = `
  query {
    productos {
      id
      nombre
      precio
      imagenes
      categoria
    }
  }
`;

export async function consultarProductos(): Promise<ProductoCatalogo[]> {
  const respuesta = await fetch(URL_SERVICIO_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: consultaProductos }),
  });

  if (!respuesta.ok) {
    throw new Error("No se pudo consultar el catálogo de productos");
  }

  const resultado = (await respuesta.json()) as RespuestaGraphQL<DatosProductos>;
  if (resultado.errors?.length) {
    throw new Error(resultado.errors[0].message);
  }

  return resultado.data?.productos ?? [];
}
