# Analisis comparativo: `cocacola_patrimonial_stg.sql` vs `cocacola_patrimonial.sql`

## Objetivo del analisis
Comparar estructura entre:
- Fuente con cambios nuevos: `cocacola_patrimonial_stg.sql`
- Destino actual: `cocacola_patrimonial.sql`

El objetivo fue identificar objetos que existen en STG y no aparecen en produccion, para preparar una migracion **sin alterar datos**.

## Hallazgos principales
- STG contiene **112** sentencias `CREATE TABLE`.
- Produccion contiene **60** sentencias `CREATE TABLE`.
- Diferencia detectada: **52 tablas adicionales** en STG.
- En ambos archivos no se detectaron sentencias `CREATE VIEW`, `CREATE FUNCTION`, `CREATE PROCEDURE`, `CREATE TRIGGER`, `CREATE SEQUENCE` ni `CREATE SCHEMA` como bloque independiente (segun el patron revisado).

## Tablas presentes en STG y ausentes en produccion
1. `areas`
2. `audit`
3. `categories_equipments`
4. `categories_services`
5. `categories_vehicles`
6. `configuration`
7. `drivers`
8. `equipments`
9. `equipments_parts`
10. `equipments_spare_parts`
11. `farms_modules`
12. `financial_patrimonial_risk_levels`
13. `fuels`
14. `fuel_types`
15. `images`
16. `license_plates`
17. `password_resets`
18. `payments`
19. `permissions_vehicles`
20. `priorities_services`
21. `reschedule_services`
22. `responsibles_payments`
23. `services`
24. `services_spare_parts`
25. `services_vehicles`
26. `services_vehicles_orders`
27. `services_vehicles_spare_parts`
28. `spare_parts`
29. `suppliers`
30. `tanks`
31. `tank_movements`
32. `tools`
33. `tools_model`
34. `tools_users`
35. `type_services`
36. `type_services_spare_parts`
37. `type_service_vehicles`
38. `type_service_vehicles_spares`
39. `users_areas`
40. `users_farms`
41. `users_players`
42. `vehicles`
43. `vehicles_km_tracker`
44. `vehicles_odometers`
45. `vehicles_spare_parts`
46. `vehicles_target_performances`
47. `view_services_spare_parts`
48. `view_services_vehicles_spare_parts`
49. `v_services_total`
50. `v_services_vehicles_total`
51. `v_weeks_numbers`
52. `workshops`

## Lectura tecnica (enfoque senior)
- La brecha estructural es relevante y parece concentrada en un modulo patrimonial/vehiculos/servicios que no esta desplegado completo en produccion.
- El nombre de algunas tablas (`view_*`, `v_*`) sugiere tablas materializadas de soporte o snapshots, no necesariamente `VIEW` SQL.
- Aplicar estas estructuras es factible **sin tocar data actual**, siempre que el script sea exclusivamente:
  - `CREATE TABLE IF NOT EXISTS ...`
  - `ALTER TABLE ... ADD COLUMN ...` (si luego validamos diferencias de columnas en tablas comunes)
  - `CREATE INDEX ...` y `ALTER TABLE ... ADD CONSTRAINT ...` cuando aplique
- Debe evitarse en produccion todo `DROP`, `TRUNCATE`, `DELETE`, `UPDATE` o cambios destructivos de tipo/renombre sin validacion previa.

## Riesgos y validaciones antes de aplicar
- Dependencias de foreign keys: varias tablas nuevas dependen de tablas base (`users`, `farms`, `catalogs`, etc.), por lo que el orden de despliegue es clave.
- Posibles diferencias en tablas compartidas (mismas tablas en ambos dumps) no listadas aqui aun a nivel columna/indice; conviene una segunda pasada de diff fino por DDL.
- Si produccion ya tiene data operativa, agregar constraints estrictas puede fallar si existen inconsistencias historicas.

## Recomendacion de siguiente paso
Si autorizas, preparo dos entregables:
1. `01_reporte_diff_fino.md`: diferencias por tabla compartida (columnas, indices, llaves).
2. `02_migracion_stg_to_prod_safe.sql`: script ordenado y seguro para produccion, solo aditivo y sin afectar data.

---

Analisis generado para decision previa a despliegue. Pendiente tu aprobacion para construir el script de migracion.
