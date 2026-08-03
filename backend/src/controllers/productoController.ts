import { Request, Response } from "express"; //estas son las importaciones necesarias para manejar las solicitudes y respuestas HTTP en Express, express es un framework de Node.js que facilita la creación de aplicaciones web y APIs, Request representa la solicitud HTTP entrante y Response representa la respuesta HTTP que se enviará al cliente
import { Producto } from "../models/producto.js"; //importamos el modelo que tendra nuestro producto, es decir la forma, quer datos y asi

export async function getProductos(req: Request, res: Response) {
  //esta funcion es asincrona, es decir que puede esperar a que se resuelvan promesas antes de continuar con la ejecucion del codigo, esto es util para operaciones que pueden tardar un tiempo, como la consulta a una base de datos, en este caso es para obtener todos los productos de la base de datos
  try {
    //el bloque try se utiliza para envolver el codigo que puede generar un error, si ocurre un error dentro del bloque try, la ejecucion se detendra y se pasara al bloque catch, donde podemos manejar el error de manera controlada
    const productos = await Producto.find();
    res.json(productos);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
}

export async function getProductoPorId(req: Request, res: Response) {
  //esta funcion es asincrona, es decir que puede esperar a que se resuelvan promesas antes de continuar con la ejecucion del codigo, esto es util para operaciones que pueden tardar un tiempo, como la consulta a una base de datos, en este caso es para obtener un producto especifico de la base de datos
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    res.json(producto);
  } catch (error) {
    console.error("Error real:", error);
    res.status(500).json({ message: "Error al obtener el producto" });
  }
}

export async function crearProducto(req: Request, res: Response) {
  //esta funcion es asincrona, es decir que puede esperar a que se resuelvan promesas antes de continuar con la ejecucion del codigo, esto es util para operaciones que pueden tardar un tiempo, como la consulta a una base de datos, en este caso es para crear un producto en la base de datos
  try {
    const newProducto = new Producto(req.body);
    const saved = await newProducto.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error real:", error);
    res.status(400).json({ message: "Error al crear producto" });
  }
}
