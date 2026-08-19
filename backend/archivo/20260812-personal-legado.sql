-- ═══════════════════════════════════════════════════════════════
-- ARCHIVO — módulo de personal y proyectos anterior a la
-- reconstrucción de Proyectos (12/08/2026).
--
-- Estas 8 tablas se retiraron de la base ese día. El sistema nuevo
-- registra la operación en jornadas / asistencias_jornada y toma las
-- personas y empresas de gestión de personal (listas SCTR), no de aquí.
--
-- QUÉ CONTIENE Y POR QUÉ SE GUARDÓ
--
-- Son los únicos datos del sistema verificados contra los Excel
-- originales de HVC. El avance calculado que producían, comprobado al
-- céntimo contra "UTP Trujillo" y "Urbanova", era:
--
--     CHOCAVENTO   avance 89.85 %   (407 de 453 equipos, 3.5 técnicos/día)
--     WAYRA I      avance 84.85 %   (168 de 198 equipos, 3.2 técnicos/día)
--
-- La fórmula era Σ equiposEjecutados / Σ equiposProgramados sobre TODOS
-- los reportes del proyecto, sin filtro de fecha.
--
-- Sirve como referencia para contrastar el avance del modelo nuevo, que
-- usa otro denominador: Σ ejecutados / totalEquipos del proyecto.
-- Los dos números NO son comparables directamente.
--
-- CÓMO SE RESTAURA
--
-- Solo tiene INSERTs: hace falta recrear antes la estructura de las
-- tablas desde una migración anterior a la de esa fecha.
-- ═══════════════════════════════════════════════════════════════

--
-- PostgreSQL database dump
--

\restrict Pf3an3l4tT2yxtYZhiLqn9dnEvrsYIyGjQwqoYKMV3aeEZFd5bOYO0aAPvp2CMz

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: proyectos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.proyectos VALUES (2, 'CHOCAVENTO', 'ENGIE ENERGIA PERU', 'Ica', 'EN_EJECUCION', '2026-08-07 16:16:40.727', '2026-08-07 16:16:40.727');
INSERT INTO public.proyectos VALUES (3, 'WAYRA I', 'ENEL GREEN POWER', 'Marcona', 'EN_EJECUCION', '2026-08-07 16:16:40.864', '2026-08-07 16:16:40.864');


--
-- Data for Name: ajustes_avance; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.ajustes_avance VALUES (14, 2, 92.00, '2026-08-12', 'Ajuste manual: el cálculo por equipos no recoge el montaje de planos y la gestión de permisos municipales, cerrados esta semana. Avance real de obra por encima del 89.85% calculado.', '2026-08-07 15:25:03.442', '2026-08-07 15:25:03.442');


--
-- Data for Name: empresas_contratistas; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.empresas_contratistas VALUES (2, 'SERVICIOS ANDINOS SAC', '20501234561', 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576');
INSERT INTO public.empresas_contratistas VALUES (3, 'MONTAJES DEL SUR EIRL', '20501234562', 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576');


--
-- Data for Name: trabajadores; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.trabajadores VALUES (4, '41000005', 'ANA LUCIA', 'MAMANI CHOQUE', 2, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (6, '41000003', 'LUIS ALBERTO', 'RAMOS SOTO', 2, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (7, '41000002', 'MARIA ELENA', 'QUISPE HUAMAN', 2, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (8, '41000001', 'JUAN CARLOS', 'PEREZ RAMOS', 2, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (9, '41000010', 'SILVIA PATRICIA', 'ROJAS CANO', 3, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (10, '41000009', 'MIGUEL ANGEL', 'VARGAS LEON', 3, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (11, '41000008', 'CARLOS ENRIQUE', 'SALAS DIAZ', 3, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (12, '41000007', 'ROSA MARIA', 'CHAVEZ PINTO', 3, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (13, '41000006', 'PEDRO PABLO', 'FLORES TORRES', 3, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.trabajadores VALUES (5, '41000004', 'JOSE MIGUEL', 'CONDORI VILCA', 3, 'ACTIVO', '2026-08-07 11:15:40.576', '2026-08-07 11:15:40.576', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: nomina_mensual; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.nomina_mensual VALUES (1, 2026, 6, 12, 3, 1675.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.095', '2026-08-07 15:08:22.095');
INSERT INTO public.nomina_mensual VALUES (2, 2026, 6, 5, 2, 1600.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.098', '2026-08-07 15:08:22.098');
INSERT INTO public.nomina_mensual VALUES (3, 2026, 6, 13, 3, 1650.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.099', '2026-08-07 15:08:22.099');
INSERT INTO public.nomina_mensual VALUES (4, 2026, 6, 4, 2, 1625.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.1', '2026-08-07 15:08:22.1');
INSERT INTO public.nomina_mensual VALUES (5, 2026, 6, 8, 2, 1525.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.101', '2026-08-07 15:08:22.101');
INSERT INTO public.nomina_mensual VALUES (6, 2026, 6, 7, 2, 1550.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.102', '2026-08-07 15:08:22.102');
INSERT INTO public.nomina_mensual VALUES (7, 2026, 6, 6, 2, 1575.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.103', '2026-08-07 15:08:22.103');
INSERT INTO public.nomina_mensual VALUES (8, 2026, 6, 9, 3, 1750.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.103', '2026-08-07 15:08:22.103');
INSERT INTO public.nomina_mensual VALUES (9, 2026, 6, 11, 3, 1700.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.104', '2026-08-07 15:08:22.104');
INSERT INTO public.nomina_mensual VALUES (10, 2026, 6, 10, 3, 1725.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.104', '2026-08-07 15:08:22.104');
INSERT INTO public.nomina_mensual VALUES (11, 2026, 7, 12, 3, 1675.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.105', '2026-08-07 15:08:22.105');
INSERT INTO public.nomina_mensual VALUES (12, 2026, 7, 5, 3, 1600.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.105', '2026-08-07 15:08:22.105');
INSERT INTO public.nomina_mensual VALUES (13, 2026, 7, 13, 3, 1650.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.106', '2026-08-07 15:08:22.106');
INSERT INTO public.nomina_mensual VALUES (14, 2026, 7, 4, 2, 1625.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.106', '2026-08-07 15:08:22.106');
INSERT INTO public.nomina_mensual VALUES (15, 2026, 7, 8, 2, 1525.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.106', '2026-08-07 15:08:22.106');
INSERT INTO public.nomina_mensual VALUES (16, 2026, 7, 7, 2, 1550.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.107', '2026-08-07 15:08:22.107');
INSERT INTO public.nomina_mensual VALUES (17, 2026, 7, 6, 2, 1575.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.107', '2026-08-07 15:08:22.107');
INSERT INTO public.nomina_mensual VALUES (18, 2026, 7, 9, 3, 1750.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.107', '2026-08-07 15:08:22.107');
INSERT INTO public.nomina_mensual VALUES (19, 2026, 7, 11, 3, 1700.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.107', '2026-08-07 15:08:22.107');
INSERT INTO public.nomina_mensual VALUES (20, 2026, 7, 10, 3, 1725.00, 'PEN', NULL, NULL, '2026-08-07 15:08:22.108', '2026-08-07 15:08:22.108');


--
-- Data for Name: supervisores; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.supervisores VALUES (2, 'ING. RICARDO SALAZAR', 'ACTIVO', '2026-08-07 16:16:40.871', '2026-08-07 16:16:40.871');
INSERT INTO public.supervisores VALUES (3, 'ING. CLAUDIA MENDOZA', 'ACTIVO', '2026-08-07 16:16:40.876', '2026-08-07 16:16:40.876');


--
-- Data for Name: reportes_diarios; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.reportes_diarios VALUES (4, '2026-08-03', 2, 2, 25, 24, 4, 96.00, 4, 95.00, '2026-08-07 16:17:29.237', '2026-08-07 16:17:29.237', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (5, '2026-08-04', 2, 2, 25, 22, 4, 88.00, 4, 92.00, '2026-08-07 16:17:29.355', '2026-08-07 16:17:29.355', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (6, '2026-08-05', 2, 2, 25, 18, 4, 72.00, 3, 88.00, '2026-08-07 16:17:29.445', '2026-08-07 16:17:29.445', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (7, '2026-08-06', 2, 2, 30, 29, 4, 96.67, 4, 96.00, '2026-08-07 16:17:29.473', '2026-08-07 16:17:29.473', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (8, '2026-08-07', 2, 2, 30, 30, 4, 100.00, 4, 98.00, '2026-08-07 16:17:29.503', '2026-08-07 16:17:29.503', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (9, '2026-08-10', 2, 2, 30, 21, 4, 70.00, 2, 80.00, '2026-08-07 16:17:29.532', '2026-08-07 16:17:29.532', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (10, '2026-08-11', 2, 2, 28, 27, 4, 96.43, 4, 94.00, '2026-08-07 16:17:29.548', '2026-08-07 16:17:29.548', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (11, '2026-08-12', 2, 2, 28, 26, 4, 92.86, 3, 93.00, '2026-08-07 16:17:29.561', '2026-08-07 16:17:29.561', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (12, '2026-08-03', 3, 3, 15, 12, 3, 80.00, 3, 85.00, '2026-08-07 16:17:29.573', '2026-08-07 16:17:29.573', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (13, '2026-08-04', 3, 3, 15, 14, 3, 93.33, 3, 90.00, '2026-08-07 16:17:29.601', '2026-08-07 16:17:29.601', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (14, '2026-08-06', 3, 3, 18, 11, 3, 61.11, 2, 70.00, '2026-08-07 16:17:29.631', '2026-08-07 16:17:29.631', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (15, '2026-08-10', 3, 3, 18, 17, 3, 94.44, 3, 91.00, '2026-08-07 16:17:29.643', '2026-08-07 16:17:29.643', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (16, '2026-08-12', 3, 3, 20, 19, 3, 95.00, 4, 93.00, '2026-08-07 16:17:29.658', '2026-08-07 16:17:29.658', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (17, '2026-08-07', 3, 3, 20, 15, 4, 75.00, 1, NULL, '2026-08-07 16:22:39.099', '2026-08-07 16:22:39.099', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (19, '2026-06-01', 2, 2, 20, 17, 4, 85.00, 4, 90.00, '2026-08-07 20:08:21.677', '2026-08-07 20:08:21.677', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (20, '2026-06-02', 2, 2, 20, 18, 4, 90.00, 4, 90.00, '2026-08-07 20:08:21.77', '2026-08-07 20:08:21.77', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (21, '2026-06-03', 2, 2, 20, 19, 4, 95.00, 4, 90.00, '2026-08-07 20:08:21.84', '2026-08-07 20:08:21.84', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (22, '2026-06-08', 2, 2, 20, 17, 4, 85.00, 4, 90.00, '2026-08-07 20:08:21.876', '2026-08-07 20:08:21.876', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (23, '2026-06-09', 2, 2, 20, 18, 4, 90.00, 4, 90.00, '2026-08-07 20:08:21.9', '2026-08-07 20:08:21.9', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (24, '2026-06-01', 3, 3, 12, 9, 3, 75.00, 3, 82.00, '2026-08-07 20:08:21.918', '2026-08-07 20:08:21.918', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (25, '2026-06-02', 3, 3, 12, 10, 3, 83.33, 3, 82.00, '2026-08-07 20:08:21.938', '2026-08-07 20:08:21.938', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (26, '2026-06-03', 3, 3, 12, 11, 3, 91.67, 3, 82.00, '2026-08-07 20:08:21.954', '2026-08-07 20:08:21.954', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (27, '2026-07-06', 2, 2, 22, 19, 4, 86.36, 3, 91.00, '2026-08-07 20:08:21.981', '2026-08-07 20:08:21.981', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (28, '2026-07-07', 2, 2, 22, 20, 4, 90.91, 3, 91.00, '2026-08-07 20:08:21.994', '2026-08-07 20:08:21.994', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (29, '2026-07-08', 2, 2, 22, 21, 4, 95.45, 3, 91.00, '2026-08-07 20:08:22.008', '2026-08-07 20:08:22.008', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (30, '2026-07-13', 2, 2, 22, 22, 4, 100.00, 3, 91.00, '2026-08-07 20:08:22.019', '2026-08-07 20:08:22.019', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (31, '2026-07-14', 2, 2, 22, 19, 4, 86.36, 3, 91.00, '2026-08-07 20:08:22.031', '2026-08-07 20:08:22.031', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (32, '2026-07-15', 2, 2, 22, 20, 4, 90.91, 3, 91.00, '2026-08-07 20:08:22.042', '2026-08-07 20:08:22.042', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (33, '2026-07-06', 3, 3, 14, 11, 4, 78.57, 4, 86.00, '2026-08-07 20:08:22.052', '2026-08-07 20:08:22.052', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (34, '2026-07-07', 3, 3, 14, 12, 4, 85.71, 4, 86.00, '2026-08-07 20:08:22.062', '2026-08-07 20:08:22.062', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (35, '2026-07-08', 3, 3, 14, 13, 4, 92.86, 4, 86.00, '2026-08-07 20:08:22.074', '2026-08-07 20:08:22.074', NULL, NULL, 1);
INSERT INTO public.reportes_diarios VALUES (36, '2026-07-13', 3, 3, 14, 14, 4, 100.00, 4, 86.00, '2026-08-07 20:08:22.085', '2026-08-07 20:08:22.085', NULL, NULL, 1);


--
-- Data for Name: participaciones; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.participaciones VALUES (4, 4, 5, 2, 2, '2026-08-03', '2026-08-07 16:17:29.268');
INSERT INTO public.participaciones VALUES (5, 4, 6, 2, 2, '2026-08-03', '2026-08-07 16:17:29.268');
INSERT INTO public.participaciones VALUES (6, 4, 7, 2, 2, '2026-08-03', '2026-08-07 16:17:29.268');
INSERT INTO public.participaciones VALUES (7, 4, 8, 2, 2, '2026-08-03', '2026-08-07 16:17:29.268');
INSERT INTO public.participaciones VALUES (8, 5, 5, 2, 2, '2026-08-04', '2026-08-07 16:17:29.371');
INSERT INTO public.participaciones VALUES (9, 5, 6, 2, 2, '2026-08-04', '2026-08-07 16:17:29.371');
INSERT INTO public.participaciones VALUES (10, 5, 7, 2, 2, '2026-08-04', '2026-08-07 16:17:29.371');
INSERT INTO public.participaciones VALUES (11, 5, 8, 2, 2, '2026-08-04', '2026-08-07 16:17:29.371');
INSERT INTO public.participaciones VALUES (12, 6, 6, 2, 2, '2026-08-05', '2026-08-07 16:17:29.45');
INSERT INTO public.participaciones VALUES (13, 6, 7, 2, 2, '2026-08-05', '2026-08-07 16:17:29.45');
INSERT INTO public.participaciones VALUES (14, 6, 8, 2, 2, '2026-08-05', '2026-08-07 16:17:29.45');
INSERT INTO public.participaciones VALUES (15, 7, 5, 2, 2, '2026-08-06', '2026-08-07 16:17:29.478');
INSERT INTO public.participaciones VALUES (16, 7, 6, 2, 2, '2026-08-06', '2026-08-07 16:17:29.478');
INSERT INTO public.participaciones VALUES (17, 7, 7, 2, 2, '2026-08-06', '2026-08-07 16:17:29.478');
INSERT INTO public.participaciones VALUES (18, 7, 8, 2, 2, '2026-08-06', '2026-08-07 16:17:29.478');
INSERT INTO public.participaciones VALUES (19, 8, 5, 2, 2, '2026-08-07', '2026-08-07 16:17:29.507');
INSERT INTO public.participaciones VALUES (20, 8, 6, 2, 2, '2026-08-07', '2026-08-07 16:17:29.507');
INSERT INTO public.participaciones VALUES (21, 8, 7, 2, 2, '2026-08-07', '2026-08-07 16:17:29.507');
INSERT INTO public.participaciones VALUES (22, 8, 8, 2, 2, '2026-08-07', '2026-08-07 16:17:29.507');
INSERT INTO public.participaciones VALUES (23, 9, 7, 2, 2, '2026-08-10', '2026-08-07 16:17:29.534');
INSERT INTO public.participaciones VALUES (24, 9, 8, 2, 2, '2026-08-10', '2026-08-07 16:17:29.534');
INSERT INTO public.participaciones VALUES (25, 10, 5, 2, 2, '2026-08-11', '2026-08-07 16:17:29.55');
INSERT INTO public.participaciones VALUES (26, 10, 6, 2, 2, '2026-08-11', '2026-08-07 16:17:29.55');
INSERT INTO public.participaciones VALUES (27, 10, 7, 2, 2, '2026-08-11', '2026-08-07 16:17:29.55');
INSERT INTO public.participaciones VALUES (28, 10, 8, 2, 2, '2026-08-11', '2026-08-07 16:17:29.55');
INSERT INTO public.participaciones VALUES (29, 11, 6, 2, 2, '2026-08-12', '2026-08-07 16:17:29.562');
INSERT INTO public.participaciones VALUES (30, 11, 7, 2, 2, '2026-08-12', '2026-08-07 16:17:29.562');
INSERT INTO public.participaciones VALUES (31, 11, 8, 2, 2, '2026-08-12', '2026-08-07 16:17:29.562');
INSERT INTO public.participaciones VALUES (32, 12, 11, 3, 3, '2026-08-03', '2026-08-07 16:17:29.576');
INSERT INTO public.participaciones VALUES (33, 12, 12, 3, 3, '2026-08-03', '2026-08-07 16:17:29.576');
INSERT INTO public.participaciones VALUES (34, 12, 13, 3, 3, '2026-08-03', '2026-08-07 16:17:29.576');
INSERT INTO public.participaciones VALUES (35, 13, 11, 3, 3, '2026-08-04', '2026-08-07 16:17:29.605');
INSERT INTO public.participaciones VALUES (36, 13, 12, 3, 3, '2026-08-04', '2026-08-07 16:17:29.605');
INSERT INTO public.participaciones VALUES (37, 13, 13, 3, 3, '2026-08-04', '2026-08-07 16:17:29.605');
INSERT INTO public.participaciones VALUES (38, 14, 12, 3, 3, '2026-08-06', '2026-08-07 16:17:29.632');
INSERT INTO public.participaciones VALUES (39, 14, 13, 3, 3, '2026-08-06', '2026-08-07 16:17:29.632');
INSERT INTO public.participaciones VALUES (40, 15, 10, 3, 3, '2026-08-10', '2026-08-07 16:17:29.645');
INSERT INTO public.participaciones VALUES (41, 15, 12, 3, 3, '2026-08-10', '2026-08-07 16:17:29.645');
INSERT INTO public.participaciones VALUES (42, 15, 13, 3, 3, '2026-08-10', '2026-08-07 16:17:29.645');
INSERT INTO public.participaciones VALUES (43, 16, 10, 3, 3, '2026-08-12', '2026-08-07 16:17:29.661');
INSERT INTO public.participaciones VALUES (44, 16, 11, 3, 3, '2026-08-12', '2026-08-07 16:17:29.661');
INSERT INTO public.participaciones VALUES (45, 16, 12, 3, 3, '2026-08-12', '2026-08-07 16:17:29.661');
INSERT INTO public.participaciones VALUES (46, 16, 13, 3, 3, '2026-08-12', '2026-08-07 16:17:29.661');
INSERT INTO public.participaciones VALUES (47, 17, 8, 2, 3, '2026-08-07', '2026-08-07 16:22:39.117');
INSERT INTO public.participaciones VALUES (48, 19, 5, 2, 2, '2026-06-01', '2026-08-07 20:08:21.7');
INSERT INTO public.participaciones VALUES (49, 19, 6, 2, 2, '2026-06-01', '2026-08-07 20:08:21.7');
INSERT INTO public.participaciones VALUES (50, 19, 7, 2, 2, '2026-06-01', '2026-08-07 20:08:21.7');
INSERT INTO public.participaciones VALUES (51, 19, 8, 2, 2, '2026-06-01', '2026-08-07 20:08:21.7');
INSERT INTO public.participaciones VALUES (52, 20, 5, 2, 2, '2026-06-02', '2026-08-07 20:08:21.78');
INSERT INTO public.participaciones VALUES (53, 20, 6, 2, 2, '2026-06-02', '2026-08-07 20:08:21.78');
INSERT INTO public.participaciones VALUES (54, 20, 7, 2, 2, '2026-06-02', '2026-08-07 20:08:21.78');
INSERT INTO public.participaciones VALUES (55, 20, 8, 2, 2, '2026-06-02', '2026-08-07 20:08:21.78');
INSERT INTO public.participaciones VALUES (56, 21, 5, 2, 2, '2026-06-03', '2026-08-07 20:08:21.846');
INSERT INTO public.participaciones VALUES (57, 21, 6, 2, 2, '2026-06-03', '2026-08-07 20:08:21.846');
INSERT INTO public.participaciones VALUES (58, 21, 7, 2, 2, '2026-06-03', '2026-08-07 20:08:21.846');
INSERT INTO public.participaciones VALUES (59, 21, 8, 2, 2, '2026-06-03', '2026-08-07 20:08:21.846');
INSERT INTO public.participaciones VALUES (60, 22, 5, 2, 2, '2026-06-08', '2026-08-07 20:08:21.88');
INSERT INTO public.participaciones VALUES (61, 22, 6, 2, 2, '2026-06-08', '2026-08-07 20:08:21.88');
INSERT INTO public.participaciones VALUES (62, 22, 7, 2, 2, '2026-06-08', '2026-08-07 20:08:21.88');
INSERT INTO public.participaciones VALUES (63, 22, 8, 2, 2, '2026-06-08', '2026-08-07 20:08:21.88');
INSERT INTO public.participaciones VALUES (64, 23, 5, 2, 2, '2026-06-09', '2026-08-07 20:08:21.903');
INSERT INTO public.participaciones VALUES (65, 23, 6, 2, 2, '2026-06-09', '2026-08-07 20:08:21.903');
INSERT INTO public.participaciones VALUES (66, 23, 7, 2, 2, '2026-06-09', '2026-08-07 20:08:21.903');
INSERT INTO public.participaciones VALUES (67, 23, 8, 2, 2, '2026-06-09', '2026-08-07 20:08:21.903');
INSERT INTO public.participaciones VALUES (68, 24, 11, 3, 3, '2026-06-01', '2026-08-07 20:08:21.921');
INSERT INTO public.participaciones VALUES (69, 24, 12, 3, 3, '2026-06-01', '2026-08-07 20:08:21.921');
INSERT INTO public.participaciones VALUES (70, 24, 13, 3, 3, '2026-06-01', '2026-08-07 20:08:21.921');
INSERT INTO public.participaciones VALUES (71, 25, 11, 3, 3, '2026-06-02', '2026-08-07 20:08:21.941');
INSERT INTO public.participaciones VALUES (72, 25, 12, 3, 3, '2026-06-02', '2026-08-07 20:08:21.941');
INSERT INTO public.participaciones VALUES (73, 25, 13, 3, 3, '2026-06-02', '2026-08-07 20:08:21.941');
INSERT INTO public.participaciones VALUES (74, 26, 11, 3, 3, '2026-06-03', '2026-08-07 20:08:21.956');
INSERT INTO public.participaciones VALUES (75, 26, 12, 3, 3, '2026-06-03', '2026-08-07 20:08:21.956');
INSERT INTO public.participaciones VALUES (76, 26, 13, 3, 3, '2026-06-03', '2026-08-07 20:08:21.956');
INSERT INTO public.participaciones VALUES (77, 27, 6, 2, 2, '2026-07-06', '2026-08-07 20:08:21.983');
INSERT INTO public.participaciones VALUES (78, 27, 7, 2, 2, '2026-07-06', '2026-08-07 20:08:21.983');
INSERT INTO public.participaciones VALUES (79, 27, 8, 2, 2, '2026-07-06', '2026-08-07 20:08:21.983');
INSERT INTO public.participaciones VALUES (80, 28, 6, 2, 2, '2026-07-07', '2026-08-07 20:08:21.996');
INSERT INTO public.participaciones VALUES (81, 28, 7, 2, 2, '2026-07-07', '2026-08-07 20:08:21.996');
INSERT INTO public.participaciones VALUES (82, 28, 8, 2, 2, '2026-07-07', '2026-08-07 20:08:21.996');
INSERT INTO public.participaciones VALUES (83, 29, 6, 2, 2, '2026-07-08', '2026-08-07 20:08:22.01');
INSERT INTO public.participaciones VALUES (84, 29, 7, 2, 2, '2026-07-08', '2026-08-07 20:08:22.01');
INSERT INTO public.participaciones VALUES (85, 29, 8, 2, 2, '2026-07-08', '2026-08-07 20:08:22.01');
INSERT INTO public.participaciones VALUES (86, 30, 6, 2, 2, '2026-07-13', '2026-08-07 20:08:22.021');
INSERT INTO public.participaciones VALUES (87, 30, 7, 2, 2, '2026-07-13', '2026-08-07 20:08:22.021');
INSERT INTO public.participaciones VALUES (88, 30, 8, 2, 2, '2026-07-13', '2026-08-07 20:08:22.021');
INSERT INTO public.participaciones VALUES (89, 31, 6, 2, 2, '2026-07-14', '2026-08-07 20:08:22.032');
INSERT INTO public.participaciones VALUES (90, 31, 7, 2, 2, '2026-07-14', '2026-08-07 20:08:22.032');
INSERT INTO public.participaciones VALUES (91, 31, 8, 2, 2, '2026-07-14', '2026-08-07 20:08:22.032');
INSERT INTO public.participaciones VALUES (92, 32, 6, 2, 2, '2026-07-15', '2026-08-07 20:08:22.044');
INSERT INTO public.participaciones VALUES (93, 32, 7, 2, 2, '2026-07-15', '2026-08-07 20:08:22.044');
INSERT INTO public.participaciones VALUES (94, 32, 8, 2, 2, '2026-07-15', '2026-08-07 20:08:22.044');
INSERT INTO public.participaciones VALUES (95, 33, 11, 3, 3, '2026-07-06', '2026-08-07 20:08:22.054');
INSERT INTO public.participaciones VALUES (96, 33, 12, 3, 3, '2026-07-06', '2026-08-07 20:08:22.054');
INSERT INTO public.participaciones VALUES (97, 33, 13, 3, 3, '2026-07-06', '2026-08-07 20:08:22.054');
INSERT INTO public.participaciones VALUES (98, 33, 5, 3, 3, '2026-07-06', '2026-08-07 20:08:22.054');
INSERT INTO public.participaciones VALUES (99, 34, 11, 3, 3, '2026-07-07', '2026-08-07 20:08:22.064');
INSERT INTO public.participaciones VALUES (100, 34, 12, 3, 3, '2026-07-07', '2026-08-07 20:08:22.064');
INSERT INTO public.participaciones VALUES (101, 34, 13, 3, 3, '2026-07-07', '2026-08-07 20:08:22.064');
INSERT INTO public.participaciones VALUES (102, 34, 5, 3, 3, '2026-07-07', '2026-08-07 20:08:22.064');
INSERT INTO public.participaciones VALUES (103, 35, 11, 3, 3, '2026-07-08', '2026-08-07 20:08:22.076');
INSERT INTO public.participaciones VALUES (104, 35, 12, 3, 3, '2026-07-08', '2026-08-07 20:08:22.076');
INSERT INTO public.participaciones VALUES (105, 35, 13, 3, 3, '2026-07-08', '2026-08-07 20:08:22.076');
INSERT INTO public.participaciones VALUES (106, 35, 5, 3, 3, '2026-07-08', '2026-08-07 20:08:22.076');
INSERT INTO public.participaciones VALUES (107, 36, 11, 3, 3, '2026-07-13', '2026-08-07 20:08:22.086');
INSERT INTO public.participaciones VALUES (108, 36, 12, 3, 3, '2026-07-13', '2026-08-07 20:08:22.086');
INSERT INTO public.participaciones VALUES (109, 36, 13, 3, 3, '2026-07-13', '2026-08-07 20:08:22.086');
INSERT INTO public.participaciones VALUES (110, 36, 5, 3, 3, '2026-07-13', '2026-08-07 20:08:22.086');


--
-- Name: ajustes_avance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ajustes_avance_id_seq', 15, true);


--
-- Name: empresas_contratistas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.empresas_contratistas_id_seq', 3, true);


--
-- Name: nomina_mensual_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nomina_mensual_id_seq', 20, true);


--
-- Name: participaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.participaciones_id_seq', 115, true);


--
-- Name: proyectos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.proyectos_id_seq', 3, true);


--
-- Name: reportes_diarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reportes_diarios_id_seq', 40, true);


--
-- Name: supervisores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supervisores_id_seq', 3, true);


--
-- Name: trabajadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.trabajadores_id_seq', 13, true);


--
-- PostgreSQL database dump complete
--

\unrestrict Pf3an3l4tT2yxtYZhiLqn9dnEvrsYIyGjQwqoYKMV3aeEZFd5bOYO0aAPvp2CMz

