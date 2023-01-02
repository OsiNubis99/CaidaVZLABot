-- ************************************** "DROPS"
DROP TABLE IF EXISTS public.user;
DROP TABLE IF EXISTS public.group;

-- ************************************** "user"
CREATE TABLE IF NOT EXISTS public.user
(
 "id_user"            varchar(50) NOT NULL,
 "first_name"         varchar(100) NOT NULL,
 "last_name"          varchar(100) NULL,
 "username"           varchar(50) NULL,
 "finished"           int DEFAULT 0,
 "win"                int DEFAULT 0,
 "win_custom"         int DEFAULT 0,
 "caida"              int DEFAULT 0,
 "caido"              int DEFAULT 0,
 "ronda"              int DEFAULT 0,
 "chiguire"           int DEFAULT 0,
 "patrulla"           int DEFAULT 0,
 "vigia"              int DEFAULT 0,
 "registro"           int DEFAULT 0,
 "maguaro"            int DEFAULT 0,
 "registrico"         int DEFAULT 0,
 "casa_chica"         int DEFAULT 0,
 "casa_grande"        int DEFAULT 0,
 "trivilin"           int DEFAULT 0,
 "alive_ronda"        int DEFAULT 0,
 "alive_chiguire"     int DEFAULT 0,
 "alive_patrulla"     int DEFAULT 0,
 "alive_vigia"        int DEFAULT 0,
 "alive_registro"     int DEFAULT 0,
 "alive_maguaro"      int DEFAULT 0,
 "alive_registrico"   int DEFAULT 0,
 "alive_casa_chica"   int DEFAULT 0,
 "alive_casa_grande"  int DEFAULT 0,
 "alive_trivilin"     int DEFAULT 0,
 "is_banned"          boolean NULL,
 CONSTRAINT "PK_user" PRIMARY KEY ( "id_user" )
);
-- ************************************** "group"
CREATE TABLE IF NOT EXISTS public.group
(
 "id_group"        varchar(50) NOT NULL,
 "name"            varchar(100) NOT NULL,
 "public"          boolean DEFAULT false,
 "paid_up_to"      date DEFAULT NULL,
 "created_at"      date DEFAULT CURRENT_DATE,
 "paid_times"      int DEFAULT 0,
 "game_mode"       int DEFAULT 1,
 "points"          int DEFAULT 24,
 "mesa"            int DEFAULT 4,
 "type"            varchar DEFAULT 'individual',
 "caida_continua"  varchar DEFAULT 'off',
 "mata_canto"      varchar DEFAULT 'off',
 "mata_mesa"       varchar DEFAULT 'off',
 "caida"           int DEFAULT 1,
 "ronda"           int DEFAULT 1,
 "chiguire"        int DEFAULT 0,
 "patrulla"        int DEFAULT 6,
 "vigia"           int DEFAULT 7,
 "registro"        int DEFAULT 8,
 "maguaro"         int DEFAULT 9,
 "registrico"      int DEFAULT 10,
 "casa_chica"      int DEFAULT 11,
 "casa_grande"     int DEFAULT 12,
 "trivilin"        int DEFAULT 24,
 CONSTRAINT "PK_group" PRIMARY KEY ( "id_group" )
);
