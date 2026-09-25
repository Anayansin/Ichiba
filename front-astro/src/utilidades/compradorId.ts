export function obtenerCompradorId(): string {
  let id = localStorage.getItem("compradorId");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("compradorId", id);
  }

  return id;
}
