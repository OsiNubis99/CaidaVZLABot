const ERROR =
  "\nSi estas experimentando algún error, por favor dejámelo saber escribiendo a @OsiNubis99.";
module.exports = {
  bad_turn: "Carta vista",
  bad_sync_cards: "Mal echada!\n",
  clean_table: "Mesa Limpia!\n",
  config_bool_invalid: "Valor invalido, las opciones son: 'on' o 'off'" + ERROR,
  config_type_invalid:
    "Valor invalido, las opciones son: 'individual' o 'parejas'" + ERROR,
  config_number_invalid:
    "Valor numérico fuera de los limites, el mínimo es 0 y el máximo es 100" +
    ERROR,
  config_undefined:
    "Configuración invalida, por favor revisa /configurar" + ERROR,
  config_not_implemented:
    "Esa configuración aún no está implementada y será ignorada.",
  config_is_ok:
    "Configuración aplicada, usa /configurar para ver los valores actuales.",
  did_sing: "cantó",
  game_is_empty:
    "El mínimo de jugadores es 2. Espera a que más jugadores se unan a la partida!",
  game_is_full:
    "El máximo de jugadores es 4. Intenta jugar la siguiente partida!",
  game_is_running:
    "El juego ya empezó. Espera a que este termine o usa /reiniciar",
  game_no_started: "El juego aun no empieza.",
  game_is_restarted: "El juego fue reiniciado, pueden unirse con /unirse",
  game_no_started_description: "Debes esperar que inicie el juego.",
  game_no_started_message: "El juego aun no empieza.",
  game_no_started_title: "El juego aun no empieza.",
  group_added: "Grupo agregado.",
  group_invalid: "Grupo no valido. Usa /list_groups listar los grupos publicos.",
  no_active_game: "No hay una partida activa en este grupo. Usa /unirse para crear una.",
  group_removed: "Grupo removido de la lista de permitidos",
  how_config:
    "\nEn esta versión de CaidaVZLABot muchas cosas son configurables!\nUsa /configurar para ver las configuraciones actuales del grupo! \n\nPuedes definir hasta cuantos puntos llegará la partida con:\n/configura points [1,100] \nPuedes definir cuantos puntos dará hacer mesa limpia con:\n/configura mesa [0,100] \nPuedes definir si quieres caída mata canto, que hace que una caída inhabilite el canto de la persona que se cayó y no se sume, con:\n/configura mata_canto on/off\nPuedes definir multiplicadores para las caídas y las rondas, y hacer que una caída valga x2 x3 o hasta x10 (x0 es inhabilitado, no cuentan)\n/configura caida [0,10]\n/configura ronda [0,10]\nPuedes definir el valor de los cantos (0 es inhabilitado, no cuentan y no será listado para ser cantado) uno por uno con:\n/configura chiguire [0,100]\n/configura patrulla [0,100]\n/configura vigia [0,100]\n/configura registro [0,100]\n/configura maguaro [0,100]\n/configura registrico [0,100]\n/configura casa_chica [0,100]\n/configura casa_grande [0,100]\n/configura trivilin [0,100]\n\n(caida_continua y mata_mesa están planeadas pero aún no implementadas)",
  invalid_value: "Valor invalido, intenta con otro." + ERROR,
  is_not_a_group:
    "Este comando solo esta disponible para su uso en grupos." + ERROR,
  no_admin_person: "No pareces ser un administrador del Bot." + ERROR,
  no_cards_description: "No tienes ninguna carta aun.",
  no_cards_message: "Esperando para Jugar...",
  no_cards_title: "🤷🏼‍♂️ No Tienes Cartas",
  no_game_description: "No estas unido a algún juego.",
  no_game_message: "No estas jugando",
  no_game_title: "No estas jugando",
  no_unban_groups: "No es posible Desbloquear un Bot.",
  no_username: "NoUsername",
  remember_reply: "Recuerda responder al mensaje del otro jugador.",
  start_by:
    "Barajando...\nPulsa el botón para escoger si empezar mesa con 1 o 4.",
  start_by_four_description: "Se intentara poner la mesa como 4 -> 3 -> 2 -> 1",
  start_by_four_message: "Iniciar por 4",
  start_by_four_title: "Iniciar por 4",
  start_by_one_description: "Se intentara poner la mesa como 1 -> 2 -> 3 -> 4",
  start_by_one_message: "Iniciar por 1",
  start_by_one_title: "Iniciar por 1",
  set_group_modes: "Escoge el nuevo modo de Juego",
  sing_killed: "La caida mato el canto del jugador anterior!\n",
  sync_cards: "Pegado en mesa ",
  user_added: "Usuario agregado.",
  user_banned: "Usuario Bloqueado.",
  user_get_fall: "Caidó\n",
  user_is_banned:
    "Usted fue bloqueado temporal o permanentemente para el uso de este Bot." +
    ERROR,
  user_is_already_joined: "Ya estas unido a esta partida",
  user_is_already_joined_other_group: "Ya estas unido a otra partida",
  user_is_not_admin: "Este comando solo debe ser usado por un #admin.",
  user_unbanned: "Usuario Desbloqueado.",
};
