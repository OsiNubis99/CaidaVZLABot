-- ************************************** "DROPS"
DROP TABLE IF EXISTS "game_user";
DROP TABLE IF EXISTS "user_sing";
DROP TABLE IF EXISTS "user_user";
DROP TABLE IF EXISTS "game";
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS "group";

-- ************************************** "user"
CREATE TABLE IF NOT EXISTS "user"
(
 "id_user"    varchar(50) NOT NULL,
 "first_name" varchar(100) NOT NULL,
 "last_name"  varchar(100) NULL,
 "username"   varchar(50) NULL,
 "is_banned"   boolean NULL,
 CONSTRAINT "PK_user" PRIMARY KEY ( "id_user" )
);
-- ************************************** "group"
CREATE TABLE IF NOT EXISTS "group"
(
 "id_group" varchar(50) NOT NULL,
 "name"     varchar(100) NOT NULL,
 CONSTRAINT "PK_group" PRIMARY KEY ( "id_group" )
);
-- ************************************** "game"
CREATE TABLE IF NOT EXISTS "game"
(
 "id_game"  SERIAL PRIMARY KEY,
 "id_group" varchar(50) NOT NULL,
 "date"     date NOT NULL,
 "finished" boolean NOT NULL,
 "plays"    int NOT NULL,
 CONSTRAINT "FK_60" FOREIGN KEY ( "id_group" ) REFERENCES "group" ( "id_group" ) ON DELETE CASCADE
);
-- ************************************** "game_user"
CREATE TABLE IF NOT EXISTS "game_user"
(
 "id_game_user" SERIAL PRIMARY KEY,
 "id_user"      varchar(50) NOT NULL,
 "id_game"      int NOT NULL,
 "points"       int NOT NULL,
 "win"          boolean NOT NULL,
 CONSTRAINT "FK_68" FOREIGN KEY ( "id_user" ) REFERENCES "user" ( "id_user" ) ON DELETE CASCADE,
 CONSTRAINT "FK_71" FOREIGN KEY ( "id_game" ) REFERENCES "game" ( "id_game" ) ON DELETE CASCADE
);
-- ************************************** "user_sing"
CREATE TABLE IF NOT EXISTS "user_sing"
(
 "id_user_sig" SERIAL PRIMARY KEY,
 "id_user"     varchar(50) NOT NULL,
 "id_game"     int NOT NULL,
 "type"        varchar(50) NOT NULL,
 "alive"       boolean NOT NULL,
 CONSTRAINT "FK_79" FOREIGN KEY ( "id_user" ) REFERENCES "user" ( "id_user" ) ON DELETE CASCADE,
 CONSTRAINT "FK_82" FOREIGN KEY ( "id_game" ) REFERENCES "game" ( "id_game" ) ON DELETE CASCADE
);
-- ************************************** "user_user"
CREATE TABLE IF NOT EXISTS "user_user"
(
 "id_caida" SERIAL PRIMARY KEY,
 "id_game"  int NOT NULL,
 "caido"    varchar(50) NOT NULL,
 "jugador"  varchar(50) NOT NULL,
 "card"     int NOT NULL,
 "kill"     varchar(50) NULL,
 CONSTRAINT "FK_31" FOREIGN KEY ( "caido" ) REFERENCES "user" ( "id_user" ) ON DELETE CASCADE,
 CONSTRAINT "FK_34" FOREIGN KEY ( "jugador" ) REFERENCES "user" ( "id_user" ) ON DELETE CASCADE,
 CONSTRAINT "FK_96" FOREIGN KEY ( "id_game" ) REFERENCES "game" ( "id_game" ) ON DELETE CASCADE
);
