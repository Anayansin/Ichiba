import mongoose from "mongoose"; //la importacion de mongoose permite la coneccion y el uso con la base de datos mongo

export async function coneccionDB() {
  //esta funcion se encarga completamente de la coneccion con la base de tados
  const uri = process.env.MONGO_URI; //perimero, buyeno hay muchas bases de datos pero se necesita saber a cual se va a conectar en .env tebnemos todas las calaves que no se comparten, en este caso accedemos a la variable de la base de datos a la que debe tener coneccion

  if (!uri) {
    //si no encuentra la variable o no esta nos dice por medio de la consola que el hay un error para la coneccion, osea que no se puede conectar a la base de datos
    console.error(
      "Error: La variable MONGO_URI no esta definida en el archivo .env",
    );
    process.exit(1); //
  }

  try {
    //este es para que haga un intento de coneccion a la base de datos, si no se puede conectar nos manda un error y nos dice que no se pudo conectar a la base de datos, para eso primero debe encontrar la variable
    await mongoose.connect(uri); //espera la coneccion
    console.log("Conectado exitosamente a MongoDB con Mongoose"); //si se conecta avisa que todo bien
  } catch (error) {
    //si no se puede conectar nos manda un error y nos dice que no se pudo conectar a la base de datos
    console.error("Error al conectar a MongoDB:", error);
    process.exit(1);
  }
}
