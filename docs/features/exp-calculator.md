# Exp Calculator

> Documento de producto. Define para qué existe esta feature y los lineamientos
> que debe respetar al evolucionar. El "cómo se ve" está en
> [`docs/design-system.md`](../design-system.md).

## Propósito

**Exp Calculator** responde una única pregunta: *"para llevar este Pokémon de un
nivel a otro, ¿cuántos **caramelos** y cuántos **fragmentos de sueño** necesito?"*.

Es una herramienta de **planificación de recursos**: no toca la Caja ni el equipo,
sólo calcula el costo de subir niveles para que puedas decidir en qué invertir.

Responde a: *"¿me alcanza para llegar a nivel X? ¿cuánto me falta juntar?"*.

## Qué hace (alcance)

Se ingresan dos datos y se lee un resultado:

- **Nivel actual** y **nivel deseado** del Pokémon.
  - Con **accesos rápidos a los niveles clave**, igual que el
    [Formulario de Pokémon](./formulario-pokemon.md): saltar a los niveles donde el
    juego desbloquea algo (ingredientes 30 / 60, sub skills 10 / 25 / 50 / 70 / 80)
    y a los topes relevantes (p. ej. el máximo actual).
- **Naturaleza que afecta la experiencia** (opcional): dos botones excluyentes
  —**EXP ⬆** y **EXP ⬇**— para indicar si el Pokémon tiene una naturaleza que
  **beneficia** o **perjudica** la subida. Por defecto, ninguno (naturaleza neutra).
- **Modo de boost** (opcional): **normal**, **Candy Boost** o **Mini Candy Boost**
  (ver [Mecánica de boost](#mecánica-de-boost)).

El **resultado** se expresa en dos números:

- **Caramelos necesarios** para cubrir la experiencia del tramo.
- **Fragmentos de sueño necesarios** para gastar esos caramelos.

## Cómo se calcula

El cálculo tiene tres piezas: **la experiencia del tramo** (depende de la curva),
**cuántos caramelos** cubren esa experiencia (depende de la naturaleza y del boost)
y **cuántos fragmentos** cuestan esos caramelos (depende del nivel y del boost).

### 1. Curvas de experiencia (4 tipos)

La experiencia total que un Pokémon necesita por nivel **depende de su especie**.
Hay **cuatro curvas**, todas proporcionales a la curva **normal** mediante un
multiplicador:

| Curva | Multiplicador | Ejemplos |
| --- | --- | --- |
| **Normal** | **×1.0** | La mayoría de las especies |
| **Pseudo‑legendario** | **×1.5** | Líneas Larvitar→Tyranitar, Dratini→Dragonite |
| **Legendario** | **×1.8** | Raikou (y legendarios equivalentes) |
| **Mítico** | **×2.2** | Celebi (y míticos equivalentes) |

La experiencia necesaria para pasar de un nivel al siguiente es:

```
exp_para_nivel(L, curva) = round( exp_base(L) × mult(curva) )
```

donde `exp_base(L)` es la tabla de la **curva normal** (p. ej. nivel 1 → 54,
nivel 10 → 345, nivel 50 → 1362 EXP; crece con el nivel) y `mult(curva)` es el
multiplicador de la tabla de arriba.

La experiencia **total** de un tramo `[actual → deseado]` es la suma de
`exp_para_nivel(L, curva)` para cada nivel `L` del tramo:

```
exp_tramo = Σ  exp_para_nivel(L, curva)     con L de (actual+1) a deseado
```

> La tabla de EXP exacta cubre hasta **nivel 55**; la calculadora acota el objetivo
> a ese máximo. Extender la tabla a niveles superiores es aditivo.

### 2. Caramelos: experiencia por caramelo

Cada caramelo aporta una **cantidad base de EXP que depende del nivel** del
Pokémon, ajustada por la **naturaleza**:

- **Base por nivel** (naturaleza neutra):
  - nivel **1–24** → **40 EXP**/caramelo
  - nivel **25–29** → **35 EXP**/caramelo
  - nivel **30+** → **25 EXP**/caramelo
- **Naturaleza**: **EXP ⬆ ≈ ×1.2** · **EXP ⬇ ≈ ×0.84** · neutra ×1.0.
- **Boost** (Candy / Mini Candy): **×2** sobre el EXP por caramelo.

```
exp_por_caramelo(L) = base(L) × mult_naturaleza × (2 si hay boost, si no 1)

caramelos = Σ  ceil( exp_para_nivel(L, curva) / exp_por_caramelo(L) )
```

El cálculo se hace **nivel a nivel**, porque tanto la EXP requerida como la base
por caramelo cambian con el nivel.

### 3. Fragmentos de sueño

Cada caramelo cuesta **fragmentos de sueño**, y ese costo **crece con el nivel** del
Pokémon (de ~14 fragmentos por caramelo en niveles bajos a varios cientos cerca del
tope actual). El costo total del tramo es la suma del costo de cada caramelo gastado
en cada nivel, multiplicado por el **factor de boost**:

```
fragmentos = Σ ( costo_fragmentos(L) × caramelos_en(L) ) × factor_boost
```

### Mecánica de boost

| Modo | EXP por caramelo | Costo en fragmentos | Tope de caramelos |
| --- | --- | --- | --- |
| **Normal** | ×1 | ×1 | — |
| **Candy Boost** | **×2** | **×5** | — |
| **Mini Candy Boost** | **×2** | **×4** | **350 caramelos** |

En ambos boosts se obtiene **el doble de experiencia por caramelo**; el sobreprecio
está en los **fragmentos de sueño**. El **Mini Candy Boost** es más barato (×4 vs
×5) pero está **acotado a 350 caramelos**: si el tramo requiere más, la calculadora
debe señalar que el resto se paga fuera del mini boost (a costo normal).

## Lineamientos

- **Dos entradas, dos salidas.** La herramienta se define por su simplicidad:
  nivel actual + nivel deseado → caramelos + fragmentos. Todo lo demás (naturaleza,
  boost) son **modificadores opcionales**, no pasos obligatorios.
- **Los shortcuts guían.** Los accesos rápidos a niveles clave reutilizan el mismo
  criterio que el [Formulario de Pokémon](./formulario-pokemon.md): los niveles que
  importan en el juego, no una escala arbitraria.
- **La curva es un input explícito.** El usuario elige la curva (normal / pseudo /
  legendario / mítico) con 4 botones; la calculadora es **independiente del
  catálogo de especies**. El multiplicador vive en el dominio; la UI sólo lo
  selecciona.
- **El cálculo vive en el dominio.** El frontend **presenta** caramelos y
  fragmentos; la suma nivel a nivel, las tablas de EXP y los factores de boost son
  del backend. La UI no reimplementa la fórmula ni inventa números.
- **Nada persiste.** Es una calculadora efímera: no lee ni escribe la Caja, no
  guarda historial. Cambiar las entradas recalcula al instante.

## Fuera de alcance

- **No optimiza.** No sugiere el "mejor" nivel al que llegar ni cuándo usar boost;
  sólo calcula el costo de la meta que el usuario define.
- **No modela la obtención de recursos.** No estima cuántos días de sueño hacen
  falta para juntar los caramelos o fragmentos (eso es otra herramienta); asume que
  los recursos ya están o se van a conseguir.
- **No cubre evolución.** El costo de **evolucionar** (caramelos de evolución) es
  una mecánica aparte; esta herramienta es sólo **subida de nivel**.
