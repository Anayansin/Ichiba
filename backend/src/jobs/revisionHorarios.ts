import cron from "node-cron";
import { Usuario } from "../models/usuario.js";
import { enviarCorreoAdvertencia } from "../services/emailService.js";

export function iniciarJobRevisionHorarios() {
  cron.schedule("0 8 * * *", async () => {
    const hoy = new Date();
    const esPrimerDiaDelMes = hoy.getDate() === 1;

    const usuarios = await Usuario.find({ tipo: "vendedor" });

    for (const usuario of usuarios) {
      const fechaConfirmacion =
        usuario.horarioConfirmadoEn ?? usuario.createdAt;
      const diasDesdeConfirmacion = Math.floor(
        (hoy.getTime() - fechaConfirmacion.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (esPrimerDiaDelMes && diasDesdeConfirmacion >= 28) {
        usuario.diasSinConfirmarHorario += 1;

        if (usuario.diasSinConfirmarHorario >= 3) {
          await Usuario.findByIdAndDelete(usuario._id);
          continue;
        }

        await usuario.save();
      }

      if (diasDesdeConfirmacion === 2 || diasDesdeConfirmacion === 15) {
        await enviarCorreoAdvertencia(
          usuario.correo,
          `Tu cuenta será eliminada si no confirmas tu horario. Llevas ${diasDesdeConfirmacion} días sin confirmar.`,
        );
      }
    }
  });
}
