# HeatShield · Capa 1 — Índice de cribado de pobreza energética en verano

**Metodología, método `h3-index-v1`** · 14 de octubre de 2026 · primer municipio: Córdoba (INE 14021)

> Este documento acompaña al código (tarea H3.10) y describe exactamente lo que el código hace.
> Si algún día no coinciden, manda el código y este documento está mal.

---

## 1. Qué es, y qué no es

Es un **índice de cribado**: una forma de ordenar los edificios residenciales de un municipio
para decidir **dónde mirar primero** en verano. Se construye solo con datos públicos que se
pueden obtener **sin entrar en ningún edificio**.

No dice si un edificio cumple el CTE ni si una vivienda está en situación de pobreza
energética. Dice dónde una visita técnica tiene más probabilidad de encontrar viviendas que se
calientan en exceso, con personas más expuestas a ese calor.

Cada valor se publica **con su rango** (extremo bajo – valor central – extremo alto). Nunca se
muestra un número suelto.

## 2. Ámbito

- Unidad: el **edificio** del Catastro (una referencia catastral de 14 caracteres).
- Se puntúan los edificios con uso principal residencial (`1_residential`) y al menos una
  vivienda. En Córdoba: **32.431** edificios. Quedan fuera 5.075 edificios no residenciales y
  344 residenciales sin viviendas registradas.
- La puntuación describe la **vivienda de última planta** del edificio: la que está bajo la
  cubierta y tiene las fachadas expuestas del edificio. Es la que más se calienta en verano.

## 3. Fuentes

Cada fichero se guarda con su fecha y su huella SHA-256; el proceso se niega a cargar un fichero
que no coincida. Los manifiestos están en `data/sources/h3/`.

| Dato | Editor | Conjunto | Fecha | Licencia |
|---|---|---|---|---|
| Huellas de edificios, año, uso, viviendas, plantas | Dirección General del Catastro | INSPIRE Buildings, descarga municipal 14900-CORDOBA | 21 ago 2026 | Sin condiciones de uso (metadatos del conjunto) |
| Altitud del terreno | Instituto Geográfico Nacional | MDT 25 m, servicio WCS INSPIRE (`Elevacion25830_25`) | consultado 14 oct 2026 | CC BY 4.0 |
| Zonas climáticas | Ministerio (CTE) | DB-HE, Anejo B (vía `lib/cte`) | — | Norma pública |
| Radiación solar de julio por orientación | Ministerio (CTE) | DA DB-HE/1, enero 2020, tablas 20 y 21 (vía `lib/cte`) | — | Norma pública |
| Secciones censales | INE | Seccionado_2021 (SECC_CE_20210101) | 1 ene 2021 | Reutilización con atribución |
| Indicadores por sección | INE | Censo de Población y Viviendas 2021, C2021_Indicadores (provisionales según el INE) | 30 jun 2023 | Reutilización con atribución |
| Certificados energéticos | Junta de Andalucía | Registro de certificados energéticos de Andalucía, provincia de Córdoba | 1 sep 2026 | CC BY 4.0 |

## 4. Cálculo, paso a paso

### 4.1 Fachadas expuestas y medianeras (deducidas, no medidas)

Ningún registro público publica qué muros de un edificio dan a la calle. Se deducen de la
geometría de la manzana:

1. Las piezas de un mismo edificio se unen; la costura entre dos piezas no es fachada.
2. Cada tramo del contorno se orienta (anillos exteriores en sentido horario, patios en sentido
   antihorario); la normal hacia fuera es el acimut del tramo menos 90°.
3. La parte de un tramo que queda a menos de **0,2 m** de la huella de otro edificio es
   **medianera**; el resto está expuesto. El Catastro declara una precisión horizontal de 0,1 m.
4. La longitud expuesta se reparte en los **ocho sectores del CTE** (DA DB-HE/1, figura 8; no son
   sectores uniformes de 45°). Los patios se cuentan aparte.

Sensibilidad en Córdoba (medianeras sobre el perímetro total / media de edificios
residenciales): 0,1 m → 18,25 % / 30,76 %; 0,2 m → 18,58 % / 31,37 %; 0,5 m → 19,57 % / 33,23 %.

Comprobación: en una manzana de prueba (26421, 20 edificios) el resultado coincide al centímetro,
edificio por edificio y orientación por orientación, con un cálculo independiente en Python.

### 4.2 Altitud y zona climática

La altitud de cada edificio es la de la celda del MDT de 25 m del IGN bajo un punto interior de
su huella, sin interpolar. La zona sale de la tabla del CTE por provincia y altitud.

Córdoba: B4 en 29.489 edificios, C4 en 8.228 (urbanizaciones de la sierra, altitud media de
266 m en las urbanas), D3 en 133. **Nota:** el CTE asigna B4 a la capital. La lectura por edificio
coincide en el casco urbano y difiere en la sierra. La severidad de verano es 4 en ambos casos y
las filas de radiación de julio de B4 y C4 difieren menos de un 1 %.

### 4.3 Radiación de julio

Para cada orientación expuesta se toma la radiación solar acumulada de julio de su zona
(DA DB-HE/1, tabla 20). Para la cubierta, la radiación sobre superficie horizontal de la zona.

### 4.4 Certificados energéticos

Del registro de la Junta se lee, por certificado: la referencia catastral, la fecha, el tipo de
edificio, la **demanda de refrigeración** (kWh/m²·año) y su letra con la escala aplicada.
**No se lee la dirección.**

- Los certificados se unen al edificio por los 14 primeros caracteres de la referencia
  catastral. Una referencia mal escrita (719 en la provincia) o una lista de viviendas de dos
  parcelas distintas (263) se cuenta y se descarta, sin corregirla.
- Por vivienda certificada cuenta su último certificado con fecha válida (2007 o posterior, y no
  posterior a la fecha del fichero). Los certificados de parcela entera cuentan como una entrada
  más.
- La demanda del edificio es la **mediana** de sus entradas, con el mínimo y el máximo al lado.
- **Tope:** antes de usarse, cada valor se limita al **percentil 99** de todos los certificados
  del municipio (Córdoba: **60,22 kWh/m²·año**; mediana 22,76). Sin ese tope, un certificado con
  1.592 kWh/m²·año ponía en primer lugar a un bloque de 16 viviendas. El valor original se
  conserva; el edificio queda marcado. Afecta a 215 edificios.

Córdoba: 40.232 certificados nombran a 12.223 de los 37.850 edificios (32,3 %); 11.695 de los
edificios puntuados tienen al menos uno.

La demanda de un certificado es la que calcula el programa de certificación con condiciones
normalizadas. No es una lectura de contador.

### 4.5 Población (Censo 2021)

Para la sección censal del edificio (por el punto interior de su huella): proporción de
personas de **más de 64 años** (t4_3), proporción de **hogares de una persona** (t22_1 / t21_1) y
**tasa de paro** (t10_1). Si alguno está protegido por secreto estadístico, el dato censal se
considera ausente. No se trata como cero.

Córdoba: 253 secciones, todas con indicadores. De los 37.850 edificios, 37.841 caen en una
sección. Los 9 restantes están a menos de 38 m del límite municipal, donde el contorno del INE y
el del Catastro no coinciden.

### 4.6 El índice

Cuatro factores, cada uno medido frente a la **mediana de los edificios residenciales del
municipio** (1,00 = edificio típico):

| Factor | Qué mide | Cálculo | Peso |
|---|---|---|---|
| Peligro (Hz) | Sol de julio sobre la cubierta | radiación horizontal de la zona ÷ mediana | 1/6 |
| Exposición (Ex) | Cubierta y fachadas a la calle | (1 + [radiación de julio sobre fachadas expuestas por metro de perímetro ÷ mediana]) ÷ 2 | 1/6 |
| Sensibilidad (En) | Demanda de refrigeración | demanda (apartado 4.7, con el peso de credibilidad del método v2) ÷ mediana | 1/3 |
| Población (Vu) | Personas más expuestas al calor | media de las tres proporciones censales, cada una ÷ su mediana | 1/3 |

**Índice = media geométrica ponderada de los cuatro factores**:
Hz^(1/6) · Ex^(1/6) · En^(1/3) · Vu^(1/3).

Por qué así:

- **Pesos por tercios de riesgo.** Se sigue el marco del IPCC (AR5, Grupo de Trabajo II), en el
  que el riesgo surge de la interacción entre peligro, exposición y vulnerabilidad. Un tercio
  corresponde al peligro y la exposición, otro al edificio y otro a las personas. Con pesos
  iguales, el clima, que apenas varía dentro de un municipio, pesaría tanto como las personas. Sin
  el factor de población, el índice dejaría fuera la parte de «pobreza» de la pobreza energética
  en verano.
- **Exposición mitad cubierta, mitad fachada.** Toda vivienda de última planta tiene cubierta, y
  su sol ya está en el factor de peligro. Por eso su mitad vale 1. El reparto real entre cubierta
  y fachada depende de la altura libre y de la planta de la vivienda, que no publica ningún
  registro. **La proporción 50/50 es una hipótesis declarada.**
- **Media geométrica.** Respeta el «×» del contrato del proyecto, y 1,00 sigue significando
  «típico».

### 4.7 El rango y los datos que faltan

El peligro y la exposición son puntuales. La sensibilidad y la población llevan rango:

- **Edificio con certificados.** w es el peso de las entradas propias del edificio frente a su
  época.
  - extremo bajo = w·mínimo + (1−w)·p10 de su época
  - valor central = w·mediana + (1−w)·p50 de su época
  - extremo alto = w·máximo + (1−w)·p90 de su época
  - **Método v1:** w = mín(1, entradas ÷ viviendas). Un certificado en una vivienda unifamiliar
    daba w = 1: el certificado **sustituía** a la estimación por época y el rango quedaba en un
    punto.
  - **Método v2 (desde el 21 oct 2026):** w = mín(1, entradas ÷ viviendas) × entradas ÷
    (entradas + k). Un certificado en una vivienda pesa ahora 1 ÷ (1 + k).
  - **k se mide, no se elige.** Es el estimador de credibilidad de **Bühlmann–Straub** (Bühlmann
    1967, *ASTIN Bulletin* 4(3); Bühlmann y Straub 1970, *Mitteilungen der VSVM* 70), calculado
    para cada época (y para el conjunto, que usan los edificios sin año) sobre los edificios
    certificados puntuados del municipio. Se usan sus **entradas** (una por vivienda, la regla
    del apartado 4.4), cada valor ya limitado por el tope:
    - varianza dentro del edificio: EPV = Σᵢ Σⱼ (xᵢⱼ − x̄ᵢ)² ÷ Σᵢ (nᵢ − 1)
    - varianza entre edificios: VHM = [Σᵢ nᵢ (x̄ᵢ − x̄)² − (r − 1)·EPV] ÷ (N − Σᵢ nᵢ² ÷ N)
    - k = EPV ÷ VHM

    nᵢ son las entradas del edificio i, r el número de edificios, N = Σ nᵢ y x̄ la media
    ponderada por nᵢ. Dicho de otro modo: k es el número de entradas que necesita un edificio
    para que su propia evidencia pese tanto como su época. Si los certificados de un mismo
    edificio discrepan mucho entre sí, k crece y el certificado aislado pesa menos.
  - **Si k no está definido, no se calcula.** Si en una época VHM ≤ 0, o ningún edificio tiene
    dos entradas, el cálculo se detiene con un error. No se sustituye por un valor.
  - Cada cálculo guarda k, EPV, VHM, edificios y entradas por época.
  - La **cobertura** que muestra la página («% de las viviendas») sigue siendo
    mín(1, entradas ÷ viviendas). El peso w se guarda aparte (`certificateWeight`).
- **Edificio sin certificado.** Se usan p10, p50 y p90 de los edificios certificados de la misma
  época del municipio. Si además falta el año, se usan los de todos los certificados.
  - Épocas: **antes de 1980** (sin norma térmica; la NBE-CT-79 es el Real Decreto 2429/1979),
    **1980–2006** y **desde 2007** (CTE DB-HE, Real Decreto 314/2006).
  - Se usa la última fecha de construcción que registra el Catastro.
- **Sin dato censal.** Se usan p10, p50 y p90 del factor de población del municipio.

Cada edificio guarda sus factores con su rango y qué datos tenía. Cada cálculo guarda el método y
las referencias, de modo que **cualquier puntuación se puede recalcular a mano**. Las pruebas lo
hacen con todos los edificios.

### 4.8 El orden

Se ordena por el **extremo alto** del rango. Es un criterio de precaución: se mira primero donde
el riesgo **podría** ser mayor. Una visita técnica (capa 2) reduce el rango.

Con el método v1, ese criterio favorecía a los edificios con un solo certificado. Su rango se
reducía a un punto y podía llegar hasta el tope (60,22 kWh/m²·año, sensibilidad 2,563). Un
edificio sin certificado no pasaba de 1,503 (p90 anterior a 1980, 35,32, frente a la mediana,
23,49). En el cálculo del 14 oct 2026, **los 20 primeros** superaban 1,503. De ellos, 14 tenían
una sola entrada, 14 eran viviendas unifamiliares y 8 se construyeron en 2000 o después. El método
v2 corrige eso (apartado 4.7). El criterio de orden no cambia.

## 5. Córdoba, cálculo `h3-index-v1-14021-2026-10-14T02:14:18.269Z`

| Referencia | Valor |
|---|---|
| Edificios puntuados | 32.431 (158.165 viviendas) |
| Medianas | radiación horizontal 235,31 kWh/m²; fachada 70,38 kWh/m por metro de perímetro; demanda 23,49 kWh/m²·año; mayores de 64: 18,94 %; hogares de una persona: 24,21 %; paro: 24,19 % |
| Demanda por época (p10 / p50 / p90, kWh/m²·año) | antes de 1980: 18,45 / 24,27 / 35,32 (n = 5.520) · 1980–2006: 16,98 / 23,49 / 34,41 (n = 4.628) · desde 2007: 15,67 / 22,42 / 33,42 (n = 1.547) |
| Tope de certificados | 60,22 kWh/m²·año (p99 de 40.232) |
| Primer décimo (3.244 edificios) | 32.564 viviendas; 1.726 edificios con certificado |
| **Brecha** del primer décimo sin certificado | **1.518 edificios, 3.729 viviendas**: donde una visita aporta más |
| Primeros 1.000 | 67 % bloques de 4 o más plantas, 80 % anteriores a 1980, 13.972 viviendas |

## 5 bis. Córdoba, cálculo `h3-index-v2-14021-2026-10-21T22:28:58.722Z`

Método `h3-index-v2`, en producción `a15dd1d`, cargado el 21 oct 2026 (22:29 UTC). Las cifras
coinciden con la simulación de solo lectura hecha antes de la carga.

| Referencia | Valor |
|---|---|
| Edificios puntuados | 32.431 (158.165 viviendas) |
| Entradas usadas | 30.586, todas con demanda de refrigeración, en 11.695 edificios certificados |
| k por época | antes de 1980: **5,586** (5.520 edificios, 15.828 entradas) · 1980–2006: **6,569** (4.628 · 11.110) · desde 2007: **2,583** (1.547 · 3.648) · conjunto: **4,945** (11.695 · 30.586) |
| Un certificado en una vivienda, antes de 1980 | pesa 1 ÷ (1 + 5,586) ≈ 0,15; con el v1 pesaba 1 |
| Tope de certificados | 60,22 kWh/m²·año; afecta a 215 edificios |
| Primeros 20 | 19 anteriores a 1980; ninguna vivienda unifamiliar; ninguno construido en 2000 o después |
| Primeros 100 | 82 anteriores a 1980 |
| Primer décimo (3.244 edificios) | 33.179 viviendas; 1.665 edificios con certificado |
| **Brecha** del primer décimo sin certificado | **1.579 edificios, 3.827 viviendas**: donde una visita aporta más |
| Concentración | 19 de los 20 primeros están en la sección censal **1402109012** |

## 5 ter. Contraste externo

**Pregunta.** ¿Señala el índice las zonas de Córdoba que una fuente oficial independiente
considera más pobres? Ningún dato de esa fuente entra en el índice.

Contraste de solo lectura del 21–22 oct 2026: SQL sobre `voltura-db` y API pública del INE, con
producción en `a15dd1d` y sobre el cálculo del apartado 5 bis. Registro completo en
`contracts/evidence/h3-index-v2/h3-outside-check-2026-10-21.md`.

**Fuente.** INE, *Atlas de Distribución de Renta de los Hogares* (operación 353, ADRH), tabla
**30980** (provincia de Córdoba), serie «Córdoba sección DDSSS. Dato base. Renta neta media por
persona». Último año, **2024**. Descargada de
`servicios.ine.es/wstempus/js/ES/DATOS_TABLA/30980?nult=1` el 21 oct 2026: 256 secciones del
municipio de Córdoba. Copia fijada:
`contracts/evidence/h3-index-v2/ine-adrh-30980-cordoba-2024-renta-persona.csv`
(sha256 `fc8f18190ce53c1df0a0c550db1a1500e3cb561123f4a28a9fe3a52714ac246f`).

**Método.**
- Para cada sección censal (límites de 2021, como en el índice) se calculan dos valores:
  - la media de `index_mid` ponderada por viviendas;
  - la proporción de sus viviendas que están en el primer décimo (`rank_high ≤ 3.244`).
- Unión con el INE por código de sección (`14021` + DDSSS). Coinciden **251 de las 253**
  secciones del cribado. El seccionado del INE de 2024 tiene 256 secciones; los códigos creados o
  divididos desde 2021 no coinciden.
- Spearman: puesto por renta (la más pobre = 1) frente a puesto por índice (el más alto = 1).
- «Solo edificio»: se repite sin el término censal. Es la media geométrica de peligro, exposición
  y sensibilidad con sus pesos del v2 (⅙, ⅙, ⅓) renormalizados a ¼, ¼, ½, sin población.

**Resultados.**

| Medida | Valor |
|---|---|
| Spearman, renta frente al índice | **0,36** |
| Spearman, renta frente a la parte «solo edificio» | **0,14** |
| Proporción de viviendas en el primer décimo: las 25 secciones más pobres | **59,7 %** |
| La misma proporción: el resto de secciones | **18,0 %** |
| De las 25 más pobres, las que tienen al menos la mitad de sus viviendas en el primer décimo | **15 de 25** |
| De las 25 más pobres, las que están también entre las 25 primeras secciones del índice | **10 de 25** |

La sección **1402109012**, donde están 19 de los 20 primeros edificios del índice, es la
**segunda sección más pobre de Córdoba: 6.042 € por persona (2024)**.

Las diez secciones más pobres y la proporción de sus viviendas en el primer décimo:

| Sección (DDSSS) | €/persona, 2024 | Proporción en el primer décimo |
|---|---|---|
| 06037 | 5.828 | 1,00 |
| 09012 | 6.042 | 1,00 |
| 06014 | 6.650 | **0,00** |
| 06041 | 6.697 | 0,24 |
| 06026 | 7.022 | 0,88 |
| 06035 | 7.594 | 1,00 |
| 09032 | 8.088 | 0,25 |
| 06033 | 8.150 | **0,00** |
| 09014 | 8.157 | 1,00 |
| 06013 | 8.364 | 1,00 |

**Lo que esto no demuestra.**
- **Parte de la coincidencia viene de un dato compartido.** El término de población (⅓ del
  índice) usa el paro del Censo 2021, que se mueve con la renta. La parte «solo edificio» coincide
  solo débilmente (0,14).
- La renta no es pobreza energética en verano. Esto muestra que el índice mira donde las rentas
  son más bajas. No muestra que esas viviendas se sobrecalienten.
- Dos de las diez secciones más pobres (06014 y 06033) **no** tienen ninguna vivienda en el primer
  décimo. Todavía no tiene explicación.
- El registro del contraste también relaciona secciones con barrios. Esa correspondencia se apoya
  en la dirección de un solo edificio y en portales inmobiliarios. Las listas de secciones de las
  zonas ERACIS no aparecían en los documentos consultados.

## 6. Limitaciones

- **Fachadas deducidas.** No se conoce qué parte de una fachada es vidrio, ni sus protecciones
  solares, ni la ventilación nocturna. Ningún registro público lo publica para todos los
  edificios. Esos datos son trabajo de la capa 2, tras una visita.
- **Patios.** Se excluyen de la exposición porque están autosombreados. Un patio amplio y
  soleado queda infravalorado.
- **Cubierta.** Se supone que toda vivienda de última planta tiene cubierta expuesta; no se
  distingue el tipo de cubierta ni su aislamiento.
- **Certificados.**
  - Cubren un tercio de los edificios, de forma desigual: solo existen para viviendas vendidas,
    alquiladas o construidas desde los decretos de certificación.
  - La demanda es un valor modelizado.
  - El tope del percentil 99 recorta también algún valor alto que podría ser real.
- **Concentración en la cabeza.**
  - Con el método v1, un edificio con un solo certificado de demanda alta subía en el orden. El
    81 % de los primeros 1.000 tenía certificado, frente al 36 % del conjunto.
  - Con el método v2, un certificado aislado ya no sustituye a la estimación por época: pesa
    1 ÷ (1 + k), unos 0,15 antes de 1980 (apartado 4.7). Entre los 20 primeros no hay ninguna
    vivienda unifamiliar. En el primer décimo, 1.665 de los 3.244 edificios tienen certificado
    (51 %), frente a 11.695 de 32.431 en el conjunto (36 %).
  - La concentración que queda es geográfica: 19 de los 20 primeros edificios están en una sola
    sección censal, la **1402109012**. Todas las viviendas de una sección comparten el factor de
    población (ver «Censo»).
- **Censo.** Datos de 2021, provisionales según el INE, por sección y no por edificio: todas las
  viviendas de una sección comparten el mismo factor de población.
- **Zona por altitud del edificio.** Se calcula por edificio; el CTE la define por localidad
  (apartado 4.2).
- **Convergencia de cuadrícula.** Las orientaciones se miden en la cuadrícula UTM; en Córdoba la
  diferencia con el norte geográfico es de unos 1,1° en la ciudad (meridiano central del huso 30: −3°), que no se corrige.
- **Índice relativo.** Compara edificios dentro de un municipio; no compara municipios entre sí.
  Al añadir otro municipio, sus referencias son las suyas.

## 7. Lo que el índice no hace

No sustituye el certificado energético de una vivienda, no comprueba el CTE y no diagnostica la
pobreza energética de un hogar. Tampoco sustituye una visita técnica, el cálculo de `qsol;jul`
(capa 2) ni la valoración de los servicios sociales.

## 8. Cómo reproducirlo

```
DATABASE_URL=… pnpm --filter @workspace/scripts h3:ingest -- \
  --manifest data/sources/h3/catastro-bu-14900.json --dir <GML descomprimidos> \
  --dem-manifest data/sources/h3/ign-mdt25-cordoba.json --dem <respuesta WCS> \
  --census-manifest data/sources/h3/ine-censo2021.json --secc-dir <Seccionado_2021> --c2021 <C2021_Indicadores.csv> \
  --epc-manifest data/sources/h3/junta-epc-cordoba.json --epc <CORDOBA.xml> \
  --index
```

En una base PostgreSQL con PostGIS, Córdoba completa tarda unos dos minutos.

## 9. Decisiones y quién las tomó

| Decisión | Quién | Cuándo |
|---|---|---|
| Primer municipio: Córdoba | Operador | 14 oct 2026 |
| Certificados del registro de la Junta en lugar de la malla del IECA (enmienda A26) | Operador | 14 oct 2026 |
| Pesos por tercios de riesgo; la puntuación describe la vivienda de última planta; orden por el extremo alto | Ejecutor, por delegación expresa del operador («elige la mejor opción»), con las alternativas medidas | 14 oct 2026 |
| Tope de certificados en el percentil 99 | Ejecutor, tras detectar el efecto de un dato erróneo en la primera ejecución | 14 oct 2026 |
| Tolerancia de medianeras de 0,2 m; reparto 50/50 entre cubierta y fachada | Ejecutor; hipótesis declaradas, sensibilidad publicada | 14 oct 2026 |
| Método v2: un certificado aislado no sustituye a la estimación por época (opción B) | Operador | 21 oct 2026, 20:52 |
| Rechazo de pesos supuestos (mezcla con k = 1 o 3; mínimo de 2 o 3 certificados) | Operador | 21 oct 2026, 20:57 |
| La corrección va primero, antes de mostrar la lista a nadie en Córdoba; k medido por Bühlmann–Straub con los certificados del propio municipio | Operador (la corrección); ejecutor (el estimador, sin constantes elegidas a mano) | 21 oct 2026, 21:06 |
| Sin k definido, el cálculo se detiene; no hay valor de reserva | Operador («refuse, never default») | 21 oct 2026 |

El método es intercambiable: todos los pesos, cuantiles y el tope son parámetros de
`IndexMethod` y se guardan con cada cálculo. Si una norma técnica nacional llegase a definir este
cribado, se sustituiría el método sin tocar los datos.
