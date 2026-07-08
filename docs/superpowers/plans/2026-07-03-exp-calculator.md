# Exp Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Exp Calculator" tool that, given a current level, a target level, an EXP-growth curve, an optional EXP-affecting nature and an optional candy-boost mode, computes the exact number of candies and dream shards needed to level up.

**Architecture:** Pure domain calculation (a candy-by-candy simulation over exact in-game EXP and dream-shard tables) exposed through the existing hexagonal stack: a domain function in a new `leveling.py`, a method on `TeamService`, a Litestar controller at `/exp-calculator`, and a standalone React page. The calculator is **fully independent of the species catalog** — the curve is a direct user input (4-button selector), not derived from a species.

**Tech Stack:** Backend — Python 3.11+, Litestar, msgspec, pytest/ruff/mypy (strict). Frontend — React + TypeScript (Vite), TanStack Query, single `styles.css`, custom i18n.

## Global Constraints

- **Hexagonal strict:** the domain imports no infrastructure; the application depends on ports, not implementations. (`CLAUDE.md`)
- **Type hints strict** (mypy strict); `@dataclass(frozen=True, slots=True)` where applicable; closed `StrEnum`s for game data. (`CLAUDE.md`)
- **Every behavior change ships with its test.** (`CLAUDE.md`)
- **No hardcoded UI strings** — every user-facing string goes through `t("key")` with both `es` and `en` entries. (`src/i18n/ui.ts`)
- **No emojis** in UI; icons come from `src/components/icons.tsx`. (`frontend/docs/ui-concept.md`)
- **Two color voices max:** indigo `--accent` for interaction, gold `--moon` for lunar identity. Reuse existing CSS classes (`.card`, `.form`, `.form__row`, `.btn--primary`, `.level-chip`). (`frontend/docs/ui-concept.md`)
- **Supported level range:** `1 ≤ current < target ≤ 55` (bounded by the exact EXP table sourced; extending it is additive).
- **Exact data tables** (verbatim, do not alter):
  - `NORMAL_EXP_TO_NEXT` — EXP to go from level *L* to *L+1*, for L=1..54 (source: game8):
    `(54, 71, 108, 128, 164, 202, 244, 274, 315, 345, 376, 407, 419, 429, 440, 454, 469, 483, 497, 515, 537, 558, 579, 600, 622, 643, 665, 686, 708, 729, 748, 766, 785, 803, 821, 839, 857, 875, 893, 910, 928, 945, 963, 980, 997, 1015, 1032, 1049, 1066, 1362, 1562, 1747, 1946, 2195)`
  - `DREAM_SHARDS_PER_CANDY` — dream shards per candy fed at level *L*, for L=1..59 (source: Serebii):
    `(14, 18, 22, 27, 30, 34, 39, 44, 48, 50, 52, 53, 56, 59, 62, 66, 68, 71, 74, 78, 81, 85, 88, 92, 95, 100, 105, 111, 117, 122, 126, 130, 136, 143, 151, 160, 167, 174, 184, 192, 201, 211, 221, 227, 236, 250, 264, 279, 295, 309, 323, 338, 356, 372, 391, 437, 486, 538, 593)`
  - Curve multipliers: `NORMAL=1.0`, `PSEUDO_LEGENDARY=1.5`, `LEGENDARY=1.8`, `MYTHICAL=2.2`.
  - EXP per candy by level band (neutral nature): level 1–24 → 40, 25–29 → 35, 30+ → 25.
  - Nature EXP multiplier: `UP=1.2`, `DOWN=0.84`, `NEUTRAL=1.0`.
  - Candy boost: `NONE` (exp ×1, shards ×1), `FULL` (exp ×2, shards ×5), `MINI` (exp ×2, shards ×4, cap **350** boosted candies; candies beyond the cap use normal rate).
  - Rounding is **round-half-up**: `_r(x) = int(x + 0.5)`.

---

### Task 1: Align the product doc with the 4-button curve decision

**Files:**
- Modify: `docs/features/exp-calculator.md`

The doc currently says *"La curva la define la especie, no el usuario."* The agreed design makes the curve a direct user input (4-button selector), so the calculator is standalone. Update the doc to match.

- [ ] **Step 1: Replace the curve lineamiento**

In `docs/features/exp-calculator.md`, replace the bullet:

```markdown
- **La curva la define la especie, no el usuario.** El multiplicador (normal /
  pseudo / legendario / mítico) sale del catálogo del dominio; el usuario no lo
  elige a mano. La calculadora sólo lo **aplica**.
```

with:

```markdown
- **La curva es un input explícito.** El usuario elige la curva (normal / pseudo /
  legendario / mítico) con 4 botones; la calculadora es **independiente del
  catálogo de especies**. El multiplicador vive en el dominio; la UI sólo lo
  selecciona.
```

- [ ] **Step 2: Note the supported range**

In the same file, at the end of the `### 1. Curvas de experiencia (4 tipos)` section, add:

```markdown
> La tabla de EXP exacta cubre hasta **nivel 55**; la calculadora acota el objetivo
> a ese máximo. Extender la tabla a niveles superiores es aditivo.
```

- [ ] **Step 3: Commit**

```bash
git add docs/features/exp-calculator.md
git commit -m "docs: la curva del Exp Calculator es input explícito (4 botones)"
```

---

### Task 2: Domain — enums, tables and core cost (no nature/boost)

**Files:**
- Modify: `backend/src/sleepmon/domain/value_objects.py`
- Create: `backend/src/sleepmon/domain/leveling.py`
- Test: `backend/tests/domain/test_leveling.py`

**Interfaces:**
- Produces (consumed by Tasks 3, 4):
  - `GrowthCurve(StrEnum)` with members `NORMAL="normal"`, `PSEUDO_LEGENDARY="pseudo_legendary"`, `LEGENDARY="legendary"`, `MYTHICAL="mythical"`.
  - `ExpNatureModifier(StrEnum)` with `NEUTRAL="neutral"`, `UP="up"`, `DOWN="down"`.
  - `CandyBoost(StrEnum)` with `NONE="none"`, `FULL="full"`, `MINI="mini"`.
  - `MAX_LEVELABLE_LEVEL: Final[int] = 55`.
  - `@dataclass(frozen=True, slots=True) LevelUpCost` with fields `current_level: int`, `target_level: int`, `total_exp: int`, `candies: int`, `dream_shards: int`, `boosted_candies: int`.
  - `def level_up_cost(current_level: int, target_level: int, *, curve: GrowthCurve = GrowthCurve.NORMAL, nature: ExpNatureModifier = ExpNatureModifier.NEUTRAL, boost: CandyBoost = CandyBoost.NONE) -> LevelUpCost`.

- [ ] **Step 1: Add the three enums to `value_objects.py`**

Append to `backend/src/sleepmon/domain/value_objects.py` (follow the existing `StrEnum` style):

```python
class GrowthCurve(StrEnum):
    """Curva de experiencia de una especie (multiplicador sobre la normal)."""

    NORMAL = "normal"
    PSEUDO_LEGENDARY = "pseudo_legendary"
    LEGENDARY = "legendary"
    MYTHICAL = "mythical"


class ExpNatureModifier(StrEnum):
    """Efecto de la naturaleza sobre la EXP por caramelo."""

    NEUTRAL = "neutral"
    UP = "up"
    DOWN = "down"


class CandyBoost(StrEnum):
    """Modo de boost al gastar caramelos."""

    NONE = "none"
    FULL = "full"
    MINI = "mini"
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/domain/test_leveling.py`:

```python
import pytest

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.leveling import LevelUpCost, level_up_cost
from sleepmon.domain.value_objects import GrowthCurve


def test_normal_one_level_counts_candies_and_shards() -> None:
    # Level 1 -> 2 needs 54 EXP; a candy gives 40 EXP (band 1-24); shards=14 at lvl 1.
    result = level_up_cost(1, 2)
    assert isinstance(result, LevelUpCost)
    assert result.current_level == 1
    assert result.target_level == 2
    assert result.total_exp == 54
    assert result.candies == 2          # 40, 80 -> 2 candies
    assert result.dream_shards == 28    # 2 * 14
    assert result.boosted_candies == 0


def test_legendary_multiplier_raises_exp_and_candies() -> None:
    # 1 -> 2 legendary: 54 * 1.8 = 97.2 -> 97 EXP; 40,80,120 -> 3 candies.
    result = level_up_cost(1, 2, curve=GrowthCurve.LEGENDARY)
    assert result.total_exp == 97
    assert result.candies == 3
    assert result.dream_shards == 42    # 3 * 14


def test_high_level_uses_25_exp_band() -> None:
    # 50 -> 51 normal: 1362 EXP; candy gives 25 EXP (band 30+); shards=309 at lvl 50.
    result = level_up_cost(50, 51)
    assert result.total_exp == 1362
    assert result.candies == 55         # 55 * 25 = 1375 >= 1362
    assert result.dream_shards == 16995  # 55 * 309


def test_target_not_greater_than_current_is_rejected() -> None:
    with pytest.raises(ValidationError):
        level_up_cost(30, 30)
    with pytest.raises(ValidationError):
        level_up_cost(40, 20)


def test_out_of_range_levels_are_rejected() -> None:
    with pytest.raises(ValidationError):
        level_up_cost(0, 10)
    with pytest.raises(ValidationError):
        level_up_cost(50, 56)
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `cd backend && pytest tests/domain/test_leveling.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sleepmon.domain.leveling'`

- [ ] **Step 3: Create `leveling.py` with tables and the core function**

Create `backend/src/sleepmon/domain/leveling.py`:

```python
"""Cálculo de caramelos y fragmentos de sueño para subir de nivel.

Simulación caramelo-a-caramelo sobre tablas exactas del juego: cada caramelo
aporta EXP según la banda del nivel actual y cuesta fragmentos según ese mismo
nivel; el excedente de EXP arrastra al siguiente nivel.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import CandyBoost, ExpNatureModifier, GrowthCurve

# EXP para pasar de nivel L a L+1, índice = L-1 (L=1..54). Fuente: game8.
NORMAL_EXP_TO_NEXT: Final[tuple[int, ...]] = (
    54, 71, 108, 128, 164, 202, 244, 274, 315, 345,
    376, 407, 419, 429, 440, 454, 469, 483, 497, 515,
    537, 558, 579, 600, 622, 643, 665, 686, 708, 729,
    748, 766, 785, 803, 821, 839, 857, 875, 893, 910,
    928, 945, 963, 980, 997, 1015, 1032, 1049, 1066, 1362,
    1562, 1747, 1946, 2195,
)

# Fragmentos por caramelo gastado en el nivel L, índice = L-1 (L=1..59). Fuente: Serebii.
DREAM_SHARDS_PER_CANDY: Final[tuple[int, ...]] = (
    14, 18, 22, 27, 30, 34, 39, 44, 48, 50,
    52, 53, 56, 59, 62, 66, 68, 71, 74, 78,
    81, 85, 88, 92, 95, 100, 105, 111, 117, 122,
    126, 130, 136, 143, 151, 160, 167, 174, 184, 192,
    201, 211, 221, 227, 236, 250, 264, 279, 295, 309,
    323, 338, 356, 372, 391, 437, 486, 538, 593,
)

MAX_LEVELABLE_LEVEL: Final[int] = len(NORMAL_EXP_TO_NEXT) + 1  # 55

_CURVE_MULTIPLIER: Final[dict[GrowthCurve, float]] = {
    GrowthCurve.NORMAL: 1.0,
    GrowthCurve.PSEUDO_LEGENDARY: 1.5,
    GrowthCurve.LEGENDARY: 1.8,
    GrowthCurve.MYTHICAL: 2.2,
}

_NATURE_MULTIPLIER: Final[dict[ExpNatureModifier, float]] = {
    ExpNatureModifier.NEUTRAL: 1.0,
    ExpNatureModifier.UP: 1.2,
    ExpNatureModifier.DOWN: 0.84,
}

# (exp multiplier, shard multiplier) por modo de boost.
_BOOST_FACTORS: Final[dict[CandyBoost, tuple[int, int]]] = {
    CandyBoost.NONE: (1, 1),
    CandyBoost.FULL: (2, 5),
    CandyBoost.MINI: (2, 4),
}
_MINI_BOOST_CAP: Final[int] = 350


@dataclass(frozen=True, slots=True)
class LevelUpCost:
    """Costo de subir de `current_level` a `target_level`."""

    current_level: int
    target_level: int
    total_exp: int
    candies: int
    dream_shards: int
    boosted_candies: int


def _r(x: float) -> int:
    """Redondeo half-up para valores positivos."""
    return int(x + 0.5)


def _exp_per_candy_base(level: int) -> int:
    if level <= 24:
        return 40
    if level <= 29:
        return 35
    return 25


def level_up_cost(
    current_level: int,
    target_level: int,
    *,
    curve: GrowthCurve = GrowthCurve.NORMAL,
    nature: ExpNatureModifier = ExpNatureModifier.NEUTRAL,
    boost: CandyBoost = CandyBoost.NONE,
) -> LevelUpCost:
    if current_level < 1:
        raise ValidationError(
            f"El nivel actual debe ser al menos 1; llegó {current_level}."
        )
    if target_level > MAX_LEVELABLE_LEVEL:
        raise ValidationError(
            f"El nivel objetivo no puede superar {MAX_LEVELABLE_LEVEL}; "
            f"llegó {target_level}."
        )
    if current_level >= target_level:
        raise ValidationError(
            "El nivel objetivo debe ser mayor que el actual; "
            f"llegó actual={current_level}, objetivo={target_level}."
        )

    curve_mult = _CURVE_MULTIPLIER[curve]
    nature_mult = _NATURE_MULTIPLIER[nature]
    exp_factor, shard_factor = _BOOST_FACTORS[boost]

    total_exp = 0
    candies = 0
    dream_shards = 0
    boosted_candies = 0
    carry = 0  # EXP arrastrada al nivel siguiente

    for level in range(current_level, target_level):
        exp_to_next = _r(NORMAL_EXP_TO_NEXT[level - 1] * curve_mult)
        total_exp += exp_to_next
        progress = carry
        while progress < exp_to_next:
            per_candy = _r(_exp_per_candy_base(level) * nature_mult)
            shard = DREAM_SHARDS_PER_CANDY[level - 1]
            apply_boost = boost is not CandyBoost.NONE and not (
                boost is CandyBoost.MINI and boosted_candies >= _MINI_BOOST_CAP
            )
            if apply_boost:
                per_candy *= exp_factor
                shard *= shard_factor
                boosted_candies += 1
            candies += 1
            dream_shards += shard
            progress += per_candy
        carry = progress - exp_to_next

    return LevelUpCost(
        current_level=current_level,
        target_level=target_level,
        total_exp=total_exp,
        candies=candies,
        dream_shards=dream_shards,
        boosted_candies=boosted_candies,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/domain/test_leveling.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `cd backend && mypy src && ruff check .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sleepmon/domain/value_objects.py backend/src/sleepmon/domain/leveling.py backend/tests/domain/test_leveling.py
git commit -m "feat(domain): cálculo de caramelos y fragmentos por nivel (curvas + tablas exactas)"
```

---

### Task 3: Domain — nature and candy-boost tests

**Files:**
- Test: `backend/tests/domain/test_leveling.py` (extend)

**Interfaces:**
- Consumes: `level_up_cost`, `LevelUpCost`, `GrowthCurve`, `ExpNatureModifier`, `CandyBoost` from Task 2.

The behavior already exists in Task 2's implementation; this task locks it with tests (nature and boost were untested above). If any test fails, fix `leveling.py` accordingly.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/domain/test_leveling.py`:

```python
from sleepmon.domain.value_objects import CandyBoost, ExpNatureModifier


def test_exp_up_nature_needs_fewer_candies() -> None:
    # 50 -> 51 (1362 EXP). Base candy 25 EXP; UP -> round(25*1.2)=30.
    up = level_up_cost(50, 51, nature=ExpNatureModifier.UP)
    assert up.candies == 46             # 46 * 30 = 1380 >= 1362


def test_exp_down_nature_needs_more_candies() -> None:
    # DOWN -> round(25*0.84)=21 EXP per candy.
    down = level_up_cost(50, 51, nature=ExpNatureModifier.DOWN)
    assert down.candies == 65           # 65 * 21 = 1365 >= 1362


def test_candy_boost_doubles_exp_and_quintuples_shards() -> None:
    # 50 -> 51: candy gives 25*2=50 EXP -> 28 candies; shards 309*5=1545 each.
    result = level_up_cost(50, 51, boost=CandyBoost.FULL)
    assert result.candies == 28
    assert result.dream_shards == 43260  # 28 * 1545
    assert result.boosted_candies == 28


def test_mini_candy_boost_quadruples_shards() -> None:
    result = level_up_cost(50, 51, boost=CandyBoost.MINI)
    assert result.candies == 28
    assert result.dream_shards == 34608  # 28 * (309 * 4)
    assert result.boosted_candies == 28


def test_mini_candy_boost_caps_boosted_candies_at_350() -> None:
    # A wide range needs well over 350 candies; only 350 get the boost.
    result = level_up_cost(1, 55, boost=CandyBoost.MINI)
    assert result.candies > 350
    assert result.boosted_candies == 350
```

- [ ] **Step 2: Run to verify (should pass against Task 2's implementation)**

Run: `cd backend && pytest tests/domain/test_leveling.py -v`
Expected: PASS (10 tests total). If a boost/nature test fails, fix `leveling.py` and re-run.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/domain/test_leveling.py
git commit -m "test(domain): naturaleza EXP y candy/mini boost (tope 350)"
```

---

### Task 4: Application — DTOs and service method

**Files:**
- Modify: `backend/src/sleepmon/application/dto.py`
- Modify: `backend/src/sleepmon/application/services.py`
- Test: `backend/tests/application/test_team_service.py` (extend)

**Interfaces:**
- Produces (consumed by Task 5):
  - `@dataclass(frozen=True, slots=True) LevelUpCostInput` with fields `current_level: int`, `target_level: int`, `curve: str = "normal"`, `nature: str = "neutral"`, `boost: str = "none"`.
  - `@dataclass(frozen=True, slots=True) LevelUpCostResult` with fields `current_level: int`, `target_level: int`, `total_exp: int`, `candies: int`, `dream_shards: int`, `boosted_candies: int`.
  - `TeamService.compute_level_up_cost(self, data: LevelUpCostInput) -> LevelUpCostResult` (abstract) + implementation in `DefaultTeamService`.
- Consumes: `level_up_cost`, `LevelUpCost`, the three enums from Task 2. Existing helper `_parse_enum` in `services.py`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/application/test_team_service.py`:

```python
def test_compute_level_up_cost_returns_candies_and_shards(
    service: DefaultTeamService,
) -> None:
    from sleepmon.application.dto import LevelUpCostInput

    result = service.compute_level_up_cost(
        LevelUpCostInput(current_level=1, target_level=2)
    )
    assert result.current_level == 1
    assert result.target_level == 2
    assert result.candies == 2
    assert result.dream_shards == 28
    assert result.boosted_candies == 0


def test_compute_level_up_cost_parses_curve_nature_boost(
    service: DefaultTeamService,
) -> None:
    from sleepmon.application.dto import LevelUpCostInput

    result = service.compute_level_up_cost(
        LevelUpCostInput(
            current_level=50,
            target_level=51,
            curve="normal",
            nature="up",
            boost="full",
        )
    )
    # UP -> 30 EXP/candy, then boost x2 -> 60 EXP/candy; 1362/60 -> 23 candies.
    assert result.candies == 23
    assert result.boosted_candies == 23


def test_compute_level_up_cost_rejects_bad_range(
    service: DefaultTeamService,
) -> None:
    from sleepmon.application.dto import LevelUpCostInput

    with pytest.raises(ValidationError):
        service.compute_level_up_cost(
            LevelUpCostInput(current_level=30, target_level=30)
        )


def test_compute_level_up_cost_rejects_unknown_curve(
    service: DefaultTeamService,
) -> None:
    from sleepmon.application.dto import LevelUpCostInput

    with pytest.raises(ValidationError):
        service.compute_level_up_cost(
            LevelUpCostInput(current_level=1, target_level=10, curve="ultra")
        )
```

(`ValidationError` is already imported at the top of this test module.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/application/test_team_service.py -k level_up_cost -v`
Expected: FAIL with `ImportError: cannot import name 'LevelUpCostInput'`

- [ ] **Step 3: Add the DTOs**

Append to `backend/src/sleepmon/application/dto.py`:

```python
@dataclass(frozen=True, slots=True)
class LevelUpCostInput:
    """Datos crudos para calcular el costo de subir de nivel."""

    current_level: int
    target_level: int
    curve: str = "normal"
    nature: str = "neutral"
    boost: str = "none"


@dataclass(frozen=True, slots=True)
class LevelUpCostResult:
    """Caramelos y fragmentos necesarios para subir de nivel."""

    current_level: int
    target_level: int
    total_exp: int
    candies: int
    dream_shards: int
    boosted_candies: int
```

- [ ] **Step 4: Add the abstract method to `TeamService`**

In `backend/src/sleepmon/application/services.py`, add to the `TeamService(ABC)` class (next to `compute_production`):

```python
    @abstractmethod
    def compute_level_up_cost(self, data: LevelUpCostInput) -> LevelUpCostResult: ...
```

Update the imports at the top of `services.py` to include the new DTOs and domain symbols:

```python
from sleepmon.application.dto import LevelUpCostInput, LevelUpCostResult
from sleepmon.domain.leveling import level_up_cost
from sleepmon.domain.value_objects import CandyBoost, ExpNatureModifier, GrowthCurve
```

(Merge these into the existing `from sleepmon.application.dto import ...` and value-object import lines rather than duplicating them.)

- [ ] **Step 5: Implement in `DefaultTeamService`**

Add to `DefaultTeamService` (next to `compute_production`). Note: pure calculation — it does **not** touch the repository or catalog.

```python
    def compute_level_up_cost(self, data: LevelUpCostInput) -> LevelUpCostResult:
        curve = _parse_enum(GrowthCurve, data.curve, "curve")
        nature = _parse_enum(ExpNatureModifier, data.nature, "nature")
        boost = _parse_enum(CandyBoost, data.boost, "boost")
        cost = level_up_cost(
            data.current_level,
            data.target_level,
            curve=curve,
            nature=nature,
            boost=boost,
        )
        return LevelUpCostResult(
            current_level=cost.current_level,
            target_level=cost.target_level,
            total_exp=cost.total_exp,
            candies=cost.candies,
            dream_shards=cost.dream_shards,
            boosted_candies=cost.boosted_candies,
        )
```

Verify `_parse_enum` raises `ValidationError` on an unknown value (it is the same helper used by `compute_production`; if it raises a different domain error, adjust the Task-4 `test_compute_level_up_cost_rejects_unknown_curve` expectation to match that error type).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/application/test_team_service.py -k level_up_cost -v`
Expected: PASS (4 tests)

- [ ] **Step 7: Typecheck, lint, full suite**

Run: `cd backend && mypy src && ruff check . && pytest -m "not integration"`
Expected: no errors; all non-integration tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/sleepmon/application/dto.py backend/src/sleepmon/application/services.py backend/tests/application/test_team_service.py
git commit -m "feat(application): compute_level_up_cost en TeamService"
```

---

### Task 5: HTTP — schema, controller and wiring

**Files:**
- Modify: `backend/src/sleepmon/adapters/inbound/http/schemas.py`
- Modify: `backend/src/sleepmon/adapters/inbound/http/controllers.py`
- Modify: `backend/src/sleepmon/adapters/inbound/http/app.py`
- Test: `backend/tests/http/test_api.py` (extend)

**Interfaces:**
- Produces: `POST /exp-calculator` accepting `{current_level, target_level, curve?, nature?, boost?}` and returning `{current_level, target_level, total_exp, candies, dream_shards, boosted_candies}`.
- Consumes: `TeamService.compute_level_up_cost`, `LevelUpCostInput` from Task 4.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/http/test_api.py`:

```python
def test_exp_calculator_returns_candies_and_shards(client: TestClient) -> None:
    res = client.post(
        "/exp-calculator",
        json={"current_level": 1, "target_level": 2},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["candies"] == 2
    assert body["dream_shards"] == 28
    assert body["boosted_candies"] == 0
    assert body["total_exp"] == 54


def test_exp_calculator_accepts_curve_nature_boost(client: TestClient) -> None:
    res = client.post(
        "/exp-calculator",
        json={
            "current_level": 50,
            "target_level": 51,
            "curve": "legendary",
            "nature": "down",
            "boost": "mini",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["candies"] > 0
    assert body["boosted_candies"] == body["candies"]


def test_exp_calculator_rejects_bad_range(client: TestClient) -> None:
    res = client.post(
        "/exp-calculator",
        json={"current_level": 30, "target_level": 30},
    )
    assert res.status_code == 400
    assert "mayor" in res.json()["detail"].lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/http/test_api.py -k exp_calculator -v`
Expected: FAIL (404, endpoint not registered)

- [ ] **Step 3: Add the msgspec schemas**

Append to `backend/src/sleepmon/adapters/inbound/http/schemas.py`:

```python
class LevelUpCostIn(msgspec.Struct, forbid_unknown_fields=True):
    """Payload para calcular el costo de subir de nivel."""

    current_level: int
    target_level: int
    curve: str = "normal"
    nature: str = "neutral"
    boost: str = "none"


class LevelUpCostOut(msgspec.Struct):
    current_level: int
    target_level: int
    total_exp: int
    candies: int
    dream_shards: int
    boosted_candies: int
```

- [ ] **Step 4: Add the controller**

In `backend/src/sleepmon/adapters/inbound/http/controllers.py`, add the schema names to the existing `from ...schemas import (...)` import block (`LevelUpCostIn`, `LevelUpCostOut`), add `LevelUpCostInput` to the `from sleepmon.application.dto import (...)` block, and add this controller class (mirror `ProductionController`; pure calc → `sync_to_thread=False`):

```python
class ExpCalculatorController(Controller):
    path = "/exp-calculator"

    @post("/", status_code=HTTP_200_OK, sync_to_thread=False)
    def compute(
        self,
        service: NamedDependency[TeamService],
        data: LevelUpCostIn,
    ) -> LevelUpCostOut:
        result = service.compute_level_up_cost(
            LevelUpCostInput(
                current_level=data.current_level,
                target_level=data.target_level,
                curve=data.curve,
                nature=data.nature,
                boost=data.boost,
            )
        )
        return LevelUpCostOut(
            current_level=result.current_level,
            target_level=result.target_level,
            total_exp=result.total_exp,
            candies=result.candies,
            dream_shards=result.dream_shards,
            boosted_candies=result.boosted_candies,
        )
```

- [ ] **Step 5: Register the controller in `app.py`**

In `backend/src/sleepmon/adapters/inbound/http/app.py`, add `ExpCalculatorController` to the `from ...controllers import (...)` import block and to the `route_handlers=[...]` list.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pytest tests/http/test_api.py -k exp_calculator -v`
Expected: PASS (3 tests)

- [ ] **Step 7: Typecheck, lint, full suite**

Run: `cd backend && mypy src && ruff check . && pytest -m "not integration"`
Expected: no errors; all non-integration tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/sleepmon/adapters/inbound/http/
git add backend/tests/http/test_api.py
git commit -m "feat(http): endpoint POST /exp-calculator"
```

---

### Task 6: Frontend — types and API client

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces (consumed by Task 7):
  - Type unions `GrowthCurve`, `ExpNatureModifier`, `CandyBoost`.
  - `LevelUpCostInput`, `LevelUpCostResult` interfaces.
  - `api.computeLevelUpCost(data: LevelUpCostInput): Promise<LevelUpCostResult>`.

- [ ] **Step 1: Add the types**

Append to `frontend/src/types.ts`:

```typescript
export type GrowthCurve = "normal" | "pseudo_legendary" | "legendary" | "mythical";
export type ExpNatureModifier = "neutral" | "up" | "down";
export type CandyBoost = "none" | "full" | "mini";

export interface LevelUpCostInput {
  current_level: number;
  target_level: number;
  curve: GrowthCurve;
  nature: ExpNatureModifier;
  boost: CandyBoost;
}

export interface LevelUpCostResult {
  current_level: number;
  target_level: number;
  total_exp: number;
  candies: number;
  dream_shards: number;
  boosted_candies: number;
}
```

- [ ] **Step 2: Add the API function**

In `frontend/src/api/client.ts`, add the import and the method to the `api` object:

```typescript
// add LevelUpCostInput, LevelUpCostResult to the existing import from "../types"

  computeLevelUpCost: (data: LevelUpCostInput) =>
    request<LevelUpCostResult>("/exp-calculator", {
      method: "POST",
      body: JSON.stringify(data),
    }),
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run build`
Expected: build succeeds (tsc has no errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts
git commit -m "feat(front): tipos y cliente API del Exp Calculator"
```

---

### Task 7: Frontend — Exp Calculator page, tab, i18n, styles

**Files:**
- Create: `frontend/src/pages/ExpCalculator.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/i18n/ui.ts`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `api.computeLevelUpCost`, the types from Task 6, `useI18n`.

> **Note on exact names:** before editing `App.tsx`, open it and copy the existing tab wiring verbatim (the `Tab` union, the `TABS` array, the nav `<button>` markup, and the `role="tabpanel"` block). Mirror that exact structure for the new `expCalculator` tab rather than the illustrative snippets below.

- [ ] **Step 1: Add i18n strings**

In `frontend/src/i18n/ui.ts`, add to **both** the `es` and `en` maps.

`es`:
```typescript
    "nav.expCalculator": "Exp Calculator",
    "expCalc.title": "Exp Calculator",
    "expCalc.intro": "Calculá cuántos caramelos y fragmentos de sueño cuesta subir de nivel.",
    "expCalc.currentLevel": "Nivel actual",
    "expCalc.targetLevel": "Nivel deseado",
    "expCalc.curve": "Curva de experiencia",
    "expCalc.curve.normal": "Normal",
    "expCalc.curve.pseudo_legendary": "Pseudo-legendario",
    "expCalc.curve.legendary": "Legendario",
    "expCalc.curve.mythical": "Mítico",
    "expCalc.nature": "Naturaleza",
    "expCalc.nature.up": "EXP ⬆",
    "expCalc.nature.down": "EXP ⬇",
    "expCalc.boost": "Boost de caramelos",
    "expCalc.boost.none": "Sin boost",
    "expCalc.boost.full": "Candy Boost",
    "expCalc.boost.mini": "Mini Candy Boost",
    "expCalc.result.candies": "Caramelos",
    "expCalc.result.dreamShards": "Fragmentos de sueño",
    "expCalc.result.boostedNote": "{n} caramelos con boost (tope 350).",
    "expCalc.error.range": "El nivel deseado debe ser mayor que el actual (máximo 55).",
```

`en`:
```typescript
    "nav.expCalculator": "Exp Calculator",
    "expCalc.title": "Exp Calculator",
    "expCalc.intro": "Work out how many candies and dream shards a level-up costs.",
    "expCalc.currentLevel": "Current level",
    "expCalc.targetLevel": "Target level",
    "expCalc.curve": "Experience curve",
    "expCalc.curve.normal": "Normal",
    "expCalc.curve.pseudo_legendary": "Pseudo-legendary",
    "expCalc.curve.legendary": "Legendary",
    "expCalc.curve.mythical": "Mythical",
    "expCalc.nature": "Nature",
    "expCalc.nature.up": "EXP ⬆",
    "expCalc.nature.down": "EXP ⬇",
    "expCalc.boost": "Candy boost",
    "expCalc.boost.none": "No boost",
    "expCalc.boost.full": "Candy Boost",
    "expCalc.boost.mini": "Mini Candy Boost",
    "expCalc.result.candies": "Candies",
    "expCalc.result.dreamShards": "Dream shards",
    "expCalc.result.boostedNote": "{n} candies boosted (cap 350).",
    "expCalc.error.range": "Target level must be higher than current (max 55).",
```

- [ ] **Step 2: Create the page component**

Create `frontend/src/pages/ExpCalculator.tsx`:

```typescript
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import type { CandyBoost, ExpNatureModifier, GrowthCurve } from "../types";

const MAX_LEVEL = 55;
const TARGET_SHORTCUTS = [10, 25, 30, 50, 55];
const CURVES: GrowthCurve[] = ["normal", "pseudo_legendary", "legendary", "mythical"];
const BOOSTS: CandyBoost[] = ["none", "full", "mini"];

export function ExpCalculator() {
  const { t } = useI18n();
  const [current, setCurrent] = useState(1);
  const [target, setTarget] = useState(10);
  const [curve, setCurve] = useState<GrowthCurve>("normal");
  const [nature, setNature] = useState<ExpNatureModifier>("neutral");
  const [boost, setBoost] = useState<CandyBoost>("none");

  const valid = current >= 1 && target > current && target <= MAX_LEVEL;

  const query = useQuery({
    queryKey: ["exp-calculator", current, target, curve, nature, boost],
    queryFn: () =>
      api.computeLevelUpCost({
        current_level: current,
        target_level: target,
        curve,
        nature,
        boost,
      }),
    enabled: valid,
  });

  const result = query.data;
  const toggleNature = (n: ExpNatureModifier) =>
    setNature((prev) => (prev === n ? "neutral" : n));

  const shortcuts = useMemo(
    () => TARGET_SHORTCUTS.filter((l) => l > current),
    [current],
  );

  return (
    <div className="layout">
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <div className="form__row">
          <label>
            {t("expCalc.currentLevel")}
            <input
              type="number"
              min={1}
              max={MAX_LEVEL - 1}
              value={current}
              onChange={(e) => setCurrent(Number(e.target.value))}
            />
          </label>
          <label>
            {t("expCalc.targetLevel")}
            <input
              type="number"
              min={2}
              max={MAX_LEVEL}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="level-shortcuts">
          {shortcuts.map((lvl) => (
            <button
              type="button"
              key={lvl}
              className={"level-chip" + (target === lvl ? " level-chip--active" : "")}
              onClick={() => setTarget(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>

        <fieldset className="calc-group">
          <legend>{t("expCalc.curve")}</legend>
          <div className="calc-options">
            {CURVES.map((c) => (
              <button
                type="button"
                key={c}
                className={"chip" + (curve === c ? " chip--active" : "")}
                onClick={() => setCurve(c)}
              >
                {t(`expCalc.curve.${c}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="calc-group">
          <legend>{t("expCalc.nature")}</legend>
          <div className="calc-options">
            <button
              type="button"
              className={"chip" + (nature === "up" ? " chip--active" : "")}
              onClick={() => toggleNature("up")}
            >
              {t("expCalc.nature.up")}
            </button>
            <button
              type="button"
              className={"chip" + (nature === "down" ? " chip--active" : "")}
              onClick={() => toggleNature("down")}
            >
              {t("expCalc.nature.down")}
            </button>
          </div>
        </fieldset>

        <fieldset className="calc-group">
          <legend>{t("expCalc.boost")}</legend>
          <div className="calc-options">
            {BOOSTS.map((b) => (
              <button
                type="button"
                key={b}
                className={"chip" + (boost === b ? " chip--active" : "")}
                onClick={() => setBoost(b)}
              >
                {t(`expCalc.boost.${b}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </form>

      <div className="card">
        <h2>{t("expCalc.title")}</h2>
        <p className="muted">{t("expCalc.intro")}</p>
        {!valid && <p className="calc-error">{t("expCalc.error.range")}</p>}
        {valid && result && (
          <div className="calc-result">
            <div className="calc-result__item">
              <span className="calc-result__value">{result.candies}</span>
              <span className="calc-result__label">{t("expCalc.result.candies")}</span>
            </div>
            <div className="calc-result__item">
              <span className="calc-result__value">{result.dream_shards}</span>
              <span className="calc-result__label">
                {t("expCalc.result.dreamShards")}
              </span>
            </div>
          </div>
        )}
        {valid && result && result.boosted_candies > 0 && (
          <p className="muted">
            {t("expCalc.result.boostedNote", { n: result.boosted_candies })}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire the tab in `App.tsx`**

Following the existing pattern you copied: (a) add `"expCalculator"` to the `Tab` union, (b) add `"expCalculator"` to the `TABS` array, (c) `import { ExpCalculator } from "./pages/ExpCalculator";`, (d) add a nav `<button id="tab-expCalculator" ...>{t("nav.expCalculator")}</button>` mirroring the other tab buttons, and (e) add the panel:

```typescript
{tab === "expCalculator" && (
  <div
    role="tabpanel"
    id="tabpanel-expCalculator"
    aria-labelledby="tab-expCalculator"
    tabIndex={0}
  >
    <ExpCalculator />
  </div>
)}
```

- [ ] **Step 4: Add styles**

Append to `frontend/src/styles.css` (reuse existing tokens; do not introduce new colors):

```css
.calc-group {
  border: none;
  padding: 0;
  margin-top: 1rem;
}

.calc-group legend {
  font-size: var(--text-sm);
  color: var(--muted);
  margin-bottom: 0.4rem;
}

.calc-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 0.4rem 0.7rem;
  font-size: var(--text-sm);
  cursor: pointer;
}

.chip--active {
  border-color: var(--accent);
  background: var(--accent-dim);
  color: var(--text);
}

.calc-result {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
}

.calc-result__item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.calc-result__value {
  font-size: var(--text-xl);
  color: var(--moon);
  font-weight: 700;
}

.calc-result__label {
  font-size: var(--text-sm);
  color: var(--muted);
}

.calc-error {
  color: var(--error);
  font-size: var(--text-sm);
}
```

- [ ] **Step 5: Typecheck / build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ExpCalculator.tsx frontend/src/App.tsx frontend/src/i18n/ui.ts frontend/src/styles.css
git commit -m "feat(front): página Exp Calculator (curva, naturaleza, boost, caramelos y fragmentos)"
```

---

### Task 8: End-to-end verification in the browser

**Files:** none (verification only).

Per the project memory, verify against the **Docker frontend on `:5173`** (CORS + HMR from the host); a separate dev server fails on CORS.

- [ ] **Step 1: Bring the stack up**

Run: `docker compose up --build -d` (db + backend:8000 + frontend:5173)

- [ ] **Step 2: Load the app and open the tab**

Use the preview tools: start/attach a preview at `http://localhost:5173`, then click the "Exp Calculator" tab. Confirm no console errors.

- [ ] **Step 3: Verify a known case**

Enter current=1, target=2, curve=Normal, no nature, no boost. Confirm the result shows **Caramelos = 2** and **Fragmentos de sueño = 28** (matches the domain test).

- [ ] **Step 4: Verify modifiers change the result**

Set current=50, target=51. Confirm Candy Boost lowers candies to **28** and raises shards; toggle EXP ⬆ / ⬇ and confirm candies change (46 / 65 with no boost). Confirm switching to Mini Candy Boost shows the "boosted candies" note when applicable.

- [ ] **Step 5: Verify validation**

Set target ≤ current. Confirm the inline range message appears and no request errors in the console/network panel.

- [ ] **Step 6: Capture proof and stop**

Take a screenshot of a computed result to attach to the PR, then `docker compose down`.

---

## Self-Review

**1. Spec coverage** (against `docs/features/exp-calculator.md`):
- Two inputs (current/target level) + two outputs (candies + dream shards) → Tasks 2–7. ✅
- Shortcuts to key levels → Task 7 `TARGET_SHORTCUTS`. ✅
- 4 EXP curves with multipliers 1.0/1.5/1.8/2.2 → Task 2 `_CURVE_MULTIPLIER`. ✅
- Two nature buttons (EXP up / down) → Task 2 `ExpNatureModifier`, Task 7 toggle. ✅
- Candy Boost (×2 exp / ×5 shards) and Mini Candy Boost (×2 exp / ×4 shards, cap 350) → Task 2 `_BOOST_FACTORS`, `_MINI_BOOST_CAP`; Task 3 tests. ✅
- EXP per candy 40/35/25 by band → Task 2 `_exp_per_candy_base`. ✅
- Curve as explicit input (not species) → Task 1 doc update + standalone page. ✅
- "El cálculo vive en el dominio; la UI sólo presenta" → domain simulation; page only renders. ✅
- "Nada persiste" → no repo access; `useQuery` recomputes on input change. ✅

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N" — every code step shows full content and every table is verbatim. ✅

**3. Type consistency:** `LevelUpCost` (domain) → `LevelUpCostResult` (app) → `LevelUpCostOut` (http) → `LevelUpCostResult` (front) all carry the same six fields (`current_level, target_level, total_exp, candies, dream_shards, boosted_candies`). Enums `GrowthCurve/ExpNatureModifier/CandyBoost` use identical string values front-to-back (`"pseudo_legendary"`, `"up"`, `"mini"`, …). `level_up_cost` keyword args (`curve`, `nature`, `boost`) match across domain/app. ✅

**Known limitation (documented, not a gap):** exact EXP data covers levels 1–55; targets above 55 are rejected by design. Extending the table is additive.
