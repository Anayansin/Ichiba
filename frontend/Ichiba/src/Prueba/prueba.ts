export type Product = {
  id: number;
  nombre: string;
  precio: number;
  imagenes: string[];
  categoria: string;
};

export const mockProducts: Product[] = [
  {
    id: 1,
    nombre: "Playera básica",
    precio: 249.99,
    imagenes: [
      "https://placehold.co/500x500?text=1",
      "https://placehold.co/500x500?text=2",
      "https://placehold.co/500x500?text=3",
    ],
    categoria: "ropa",
  },
  {
    id: 2,
    nombre: "Tenis urbanos",
    precio: 899.0,
    imagenes: ["https://placehold.co/500x500?text=Tenis"],
    categoria: "ropa",
  },
];
