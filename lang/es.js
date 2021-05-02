const ERROR =
  "\nSi estas experimentando algún error, por favor dejámelo saber escribiendo a @OsiNubis99.";
const USE_JOIN = "\nUsa /unirse para unirte a la partida.";
const USE_START =
  "\nUsa /iniciar para configurar e iniciar la partida o /inicia_ya para saltarte la configuración";
module.exports = {
  config_bool_invalid: "Valor invalido, las opciones son: 'on' o 'off'" + ERROR,
  config_type_invalid:
    "Valor invalido, las opciones son: 'individual' o 'parejas'" + ERROR,
  config_number_invalid:
    "Valor numérico fuera de los limites, el mínimo es 0 y el máximo es 100" +
    ERROR,
  config_undefined:
    "Configuración invalida, por favor revisa /configurar" + ERROR,
  config_is_ok:
    "Configuración aplicada, usa /configurar para ver los valores actuales.",
  game_already_created: "El juego ya esta creado." + USE_JOIN,
  game_created: "Juego creado." + USE_JOIN,
  game_is_empty:
    "El mínimo de jugadores es 2. Espera a que más jugadores se unan a la partida!", // TODO Make a nice Game_is_empty Message
  game_is_full:
    "El máximo de jugadores es 4. Intenta jugar la siguiente partida!",
  game_is_running:
    "El juego ya empezó. Espera a que este termine o un administrador que use /reiniciar", // TODO Make a nice Game_running Message
  game_no_created: "El juego aun no esta creado \nUsa /crear para poder jugar.",
  game_no_started: "El juego aun no empieza." + USE_START,
  game_no_started_description: "Debes esperar que inicie el juego.",
  game_no_started_message: "El juego aun no empieza.",
  game_no_started_title: "El juego aun no empieza.",
  group_added: "Grupo agregado.",
  group_removed: "Grupo removido de la lista de permitidos",
  how_config: "TODO", // TODO Make a nice How_config Message
  invalid_value: "Valor invalido, intenta con otro." + ERROR,
  is_not_a_group:
    "Este comando solo esta disponible para su uso en grupos." + ERROR,
  no_admin_person: "No pareces ser un administrador del Bot." + ERROR,
  no_ban_groups: "No es posible Bloquear un Bot.",
  no_cards_description: "No tienes ninguna carta aun.",
  no_cards_message: "Esperando para Jugar...",
  no_cards_title: "🤷🏼‍♂️ No Tienes Cartas",
  no_game_description: "No estas unido a algún juego.",
  no_game_message: "/unirse",
  no_game_title: "No estas jugando",
  no_unban_groups: "No es posible Desbloquear un Bot.",
  no_username: "NoUsername",
  remember_reply: "Recuerda responder al mensaje del otro jugador.",
  start_by:
    "Barajando...Pulsa el botón para escoger si empezar mesa con 1 o 4.",
  set_group_modes: "Escoge el nuevo modo de Juego",
  user_added: "Usuario agregado.",
  user_banned: "Usuario Bloqueado.",
  user_is_banned:
    "Usted fue bloqueado temporal o permanentemente para el uso de este Bot." +
    ERROR,
  user_is_already_joined: "Ya estas unido a esta partida",
  user_unbanned: "Usuario Desbloqueado.",
};
