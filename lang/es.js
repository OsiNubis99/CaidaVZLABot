const ERROR =
  "\nSi estas experimentando algún error, por favor dejámelo saber escribiendo a @OsiNubis99.";
module.exports = {
  config_bool_invalid: "Valor invalido, las opciones son: 'on' o 'off'" + ERROR,
  config_type: "TODO",
  config_type_invalid:
    "Valor invalido, las opciones son: 'individual' o 'parejas'" + ERROR,
  config_number_invalid:
    "Valor numérico fuera de los limites, el mínimo es 0 y el máximo es 100" +
    ERROR,
  config_undefined:
    "Configuración invalida, por favor revisa /configurar" + ERROR,
  game_already_created: "game is already created", // TODO Make a nice Game_already_created Message
  game_created: "created", // TODO Make a nice Game_created Message
  game_is_full: "is full", // TODO Make a nice Game_is_full Message
  game_is_running: "game running", // TODO Make a nice Game_running Message
  game_no_created: "no created", // TODO Make a nice Game_no_created Message
  game_no_started: "no started", // TODO Make a nice Game_no_started Message
  group_added: "Grupo agregado.",
  group_removed: "Grupo removido de la lista de permitidos",
  how_config: "TODO", // TODO Make a nice How_config Message
  invalid_value: "Valor invalido, intenta con otro." + ERROR,
  is_not_a_group:
    "Este comando solo esta disponible para su uso en grupos." + ERROR,
  no_admin_person: "No pareces ser un administrador del Bot." + ERROR,
  no_ban_groups: "No es posible Bloquear un Bot.",
  no_unban_groups: "No es posible Desbloquear un Bot.",
  remember_reply: "Recuerda responder al mensaje del otro jugador.",
  set_group_modes: "Escoge el nuevo modo de Juego",
  user_added: "Usuario agregado.",
  user_banned: "Usuario Bloqueado.",
  user_is_banned:
    "Usted fue bloqueado temporal o permanentemente para el uso de este Bot." +
    ERROR,
  user_joined: "TODO", // TODO Make a nice User_joined Message
  user_unbanned: "Usuario Desbloqueado.",
};
