-- ************************************** "DROPS"
DROP TABLE IF EXISTS public.user;
DROP TABLE IF EXISTS public.group;

-- ************************************** "user"
CREATE TABLE IF NOT EXISTS public.user
(
 "id_user"     varchar(50) NOT NULL,
 "first_name"  varchar(100) NOT NULL,
 "last_name"   varchar(100) NULL,
 "username"    varchar(50) NULL,
 "finished"    int DEFAULT 0,
 "win"         int DEFAULT 0,
 "win_custom"  int DEFAULT 0,
 "sings"       int DEFAULT 0,
 "caida"       int DEFAULT 0,
 "caido"       int DEFAULT 0,
 "is_banned"   boolean NULL,
 CONSTRAINT "PK_user" PRIMARY KEY ( "id_user" )
);
-- ************************************** "group"
CREATE TABLE IF NOT EXISTS public.group
(
 "id_group"        varchar(50) NOT NULL,
 "name"            varchar(100) NOT NULL,
 "public"          boolean DEFAULT false,
 "apid_at"         date DEFAULT CURRENT_DATE,
 "created_at"      date DEFAULT CURRENT_DATE,
 "paid_times"      int DEFAULT 1,
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
