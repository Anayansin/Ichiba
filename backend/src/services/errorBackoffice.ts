/**
 * Error de negocio del BackOffice con el código HTTP que le corresponde.
 *
 * Vive en su propio módulo para que los servicios del backoffice, los de
 * adeudos (RQNF37/RQNF38) y los de disputas (RQF40) puedan lanzarlo sin
 * depender unos de otros (evita ciclos de importación). Los controladores
 * REST lo traducen a `res.status`, y las herramientas MCP a un mensaje de
 * error legible.
 */
export class ErrorBackoffice extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorBackoffice";
  }
}
