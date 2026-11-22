import mongoose from "mongoose";

export async function coneccionDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      "La variable MONGO_URI no esta definida en el archivo .env",
    );
  }

  try {
    await mongoose.connect(uri);
    console.log("Conectado exitosamente a MongoDB con Mongoose");
  } catch (error) {
    console.error("Error al conectar a MongoDB:", error);
    throw error;
  }
}
