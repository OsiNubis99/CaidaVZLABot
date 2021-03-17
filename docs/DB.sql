-- ************************************** "DROPS"
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS "group";

-- ************************************** "user"
CREATE TABLE IF NOT EXISTS "user"
(
 "id_user"    	varchar(50) NOT NULL,
 "first_name" 	varchar(100) NOT NULL,
 "last_name"  	varchar(100) NULL,
 "username"   	varchar(50) NULL,
 "finished"   	int DEFAULT 0,
 "win"   	      int DEFAULT 0,
 "sings"   			int DEFAULT 0,
 "caida"   			int DEFAULT 0,
 "caido"   			int DEFAULT 0,
 "is_banned"   	boolean NULL,
 CONSTRAINT "PK_user" PRIMARY KEY ( "id_user" )
);
-- ************************************** "group"
CREATE TABLE IF NOT EXISTS "group"
(
 "id_group"				varchar(50) NOT NULL,
 "name"						varchar(100) NOT NULL,
 "game_mode"   		int DEFAULT 1,
 "points"   			int DEFAULT 24,
 "type"   				varchar DEFAULT 'parejas',
 "caida_continua"	varchar DEFAULT 'off',
 "mata_canto"   	varchar DEFAULT 'off',
 "mata_mesa"   		varchar DEFAULT 'off',
 "mesa"   				int DEFAULT 1,
 "caida"   				int DEFAULT 1,
 "ronda"   				int DEFAULT 1,
 "chiguire"				int DEFAULT 0,
 "patrulla"				int DEFAULT 6,
 "vigia"   				int DEFAULT 7,
 "registro"				int DEFAULT 8,
 "maguaro"   			int DEFAULT 9,
 "registrico"			int DEFAULT 10,
 "casa_chica"			int DEFAULT 11,
 "casa_grande"		int DEFAULT 12,
 "trivilin"				int DEFAULT 24,
 CONSTRAINT "PK_group" PRIMARY KEY ( "id_group" )
);
