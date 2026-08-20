# Calculadora de caramelos

> Documento escrito en español a pedido explícito, como excepción a la regla de
> escribir la documentación en inglés.

## Propósito

La **calculadora de caramelos** responde *"¿cuánto me cuesta subir este Pokémon de
este nivel a este otro?"*. Los niveles no se suben jugando: se suben gastando
**caramelos**, y cada caramelo cuesta **fragmentos de sueño**. Antes de gastar,
querés saber el precio del salto.

Interesan sobre todo los niveles que **desbloquean algo**: sub skills en **10, 25,
50 y 70**, ingredientes en **30 y 60**. Son los saltos que cambian lo que el
Pokémon rinde, y los que justifican vaciar el inventario de fragmentos.

Es una herramienta **efímera y de consulta**: no guarda nada, no toca la
[Box](0001-box.md) y no necesita sesión. Se responde una pregunta y se cierra.

## Qué hace (alcance)

1. **Elegís el tramo**: nivel de **origen** (1–69) y nivel de **destino** (2–70).
2. **Ajustás el Pokémon**: su **categoría** —normal (por defecto),
   pseudo-legendario, legendario o mítico— y el **efecto de su naturaleza sobre la
   EXP** —neutra (por defecto), acelera o retrasa.
3. **Opcionalmente cargás la EXP** que ya tenés acumulada dentro del nivel de
   origen.
4. **Leés el costo**: cuántos **caramelos** y cuántos **fragmentos de sueño**
   necesitás para ese tramo.
5. **Atajos a los hitos**: fijan el destino en **10, 25, 30, 50, 60 o 70** e indican
   qué desbloquea cada uno.

## Cómo funciona

El cálculo camina el tramo **nivel por nivel**, porque el precio en fragmentos
cambia en cada uno.

### Cuánta EXP hace falta

Cada nivel tiene una **EXP para pasar al siguiente**, tabulada para los 69 saltos
que van del nivel 1 al 70. La **categoría** multiplica ese número y el resultado se
redondea **al entero más cercano** en cada nivel:

| Categoría | Multiplicador |
| --- | --- |
| Normal | 1,0 |
| Pseudo-legendario | 1,5 |
| Legendario | 1,8 |
| Mítico | 2,2 |

Un legendario a nivel 1 necesita **97** EXP (54 × 1,8 = 97,2) donde un normal
necesita 54.

### Cuánta EXP da un caramelo

Un caramelo de especie vale **25 EXP**, ajustada por la naturaleza:

| Naturaleza | EXP por caramelo |
| --- | --- |
| Acelera la EXP | 30 |
| Neutra | 25 |
| Retrasa la EXP | 21 |

La categoría **no** interviene acá: encarece el destino, no abarata el caramelo.

### Cómo se gastan

Los caramelos se aplican **de a uno** y la **EXP sobrante se arrastra** al nivel
siguiente: si un nivel pide 54 y llevás 75, subís con 21 a favor. Por eso el total
de caramelos es la EXP total del tramo dividida por lo que rinde cada caramelo,
redondeando **hacia arriba una sola vez al final** — no una vez por nivel.

### Cuánto cuesta cada caramelo

Los **fragmentos** dependen **del nivel en que se gasta el caramelo**: van de 14 en
el nivel 1 a 1272 en el nivel 69, tabulados nivel por nivel. La categoría **no** los
afecta. El total es la suma de cada caramelo a su precio: los que cayeron en el
nivel 1 × 14, los del nivel 2 × 18, y así hasta el destino.

### EXP parcial

El campo opcional descuenta la EXP que ya tenés dentro del nivel de origen. Admite
de **0** hasta **uno menos** que la EXP requerida por ese nivel: si la llenaras, ya
estarías en el siguiente. Ese tope depende del nivel de origen **y** de la
categoría, así que cambiar cualquiera de los dos lo recalcula.

### El tope

El origen va de **1 a 69**, el destino de **2 a 70**, y el destino es **siempre
mayor** que el origen. El nivel 70 es el máximo alcanzable con caramelos.

### Un ejemplo completo

Un Pokémon **normal**, de naturaleza **neutra**, de **nivel 1 a 10**, sin EXP
parcial: el tramo pide **1560** de EXP, que a 25 por caramelo dan 62,4 →
**63 caramelos**. Repartidos por nivel son 3 en el 1, 2 en el 2, 5 en el 3, 5 en el
4, 6 en el 5, 9 en el 6, 9 en el 7, 11 en el 8 y 13 en el 9, cada uno al precio de
su nivel → **2268 fragmentos**.

## Criterios de aceptación

- **Caso base:** normal, neutra, 1→10, sin EXP parcial → **63 caramelos y 2268
  fragmentos**.
- **Naturaleza:** el mismo tramo con una naturaleza que **acelera** → **52 caramelos
  y 1859 fragmentos**. Con una que **retrasa**, el total de caramelos sube respecto
  del caso base.
- **Categoría y redondeo:** **legendario**, neutra, 1→2 → el nivel pide **97** EXP
  (54 × 1,8 = 97,2) → **4 caramelos y 56 fragmentos**. **Mítico** en el mismo tramo
  pide **119** (118,8) → **5 caramelos y 70 fragmentos**.
- **EXP parcial:** normal, neutra, 1→2 con **30** de EXP cargada → **1 caramelo y 14
  fragmentos**.
- **Tramo caro:** normal, neutra, 69→70 → **131 caramelos y 166.632 fragmentos**.
- **Sin estado vacío:** la herramienta abre con valores válidos —nivel **1 → 10**,
  normal, neutra— y ya muestra un resultado; nunca hay una pantalla en blanco
  esperando entrada.
- **Tramo inválido imposible:** el origen se limita a **1–69**, el destino a
  **2–70**, y el destino siempre queda por encima del origen. Si al subir el origen
  el destino quedara igual o por debajo, el destino pasa a ser **origen + 1**. No
  existe estado de error por tramo inválido.
- **EXP parcial acotada:** admite de **0** hasta **uno menos** que la EXP requerida
  del nivel de origen. Cambiar el **nivel de origen** o la **categoría** reajusta
  ese tope y recorta el valor cargado si quedó por encima.
- **Atajos de hito:** fijan el destino en 10, 25, 30, 50, 60 o 70, dicen **qué
  desbloquea** cada uno, y solo se ofrecen los que están **por encima del origen**.

## Guidelines

- **Efímera y abierta.** No guarda, no pide sesión, no toca la Box. Entrás,
  preguntás, salís.
- **Conservadora.** Donde hay que redondear caramelos, redondea **hacia arriba**: el
  número que muestra alcanza siempre.
- **Cada modificador en su lugar.** La categoría encarece el destino (EXP
  requerida), la naturaleza cambia lo que rinde el caramelo, y los fragmentos
  dependen únicamente del nivel donde se gasta. Ninguno se filtra al terreno del
  otro.
- **El cálculo vive en el dominio**, como el resto de los números de la app.
- **El tope 70 es de los datos, no del diseño.** Si el juego extiende las tablas, se
  agregan valores; la mecánica no cambia.

## Fuera de alcance

- **Caramelos genéricos (Handy Candy S/M/L)** — solo caramelos de especie a 25 EXP.
- **Descuentos y eventos** — el boost de fragmentos del Pokémon GO Plus+ y los
  eventos de EXP ×1,5 o ×2.
- **La EXP que se gana durmiendo** — esto cuenta caramelos, no simula el progreso
  pasivo.
- **El modo inverso** (*"tengo N caramelos, ¿hasta dónde llego?"*) — queda como
  iteración futura.
- **El desglose tramo por tramo entre hitos** — el resultado es el total del tramo
  elegido.
- **Elegir la especie y deducir su categoría** — la categoría se elige a mano.
- **Guardar el resultado o aplicarlo a un Pokémon de la Box** — no hay persistencia
  ni vínculo con la Box.
- **El desbloqueo de sub skill del nivel 80** — fuera del tope alcanzable con
  caramelos.
- **Recomendar a quién conviene subir** — responde el costo, no la decisión.
