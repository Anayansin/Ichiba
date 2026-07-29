import mongoose from "mongoose";

export async function coneccionDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error(
      "Error: La variable MONGO_URI no está definida en el archivo .env",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("Conectado exitosamente a MongoDB con Mongoose");
  } catch (error) {
    console.error("Error al conectar a MongoDB:", error);
    process.exit(1);
  }
}
