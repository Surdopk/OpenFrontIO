import {
  Execution,
  Game,
  isUnit,
  OwnerComp,
  Unit,
  UnitParams,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PathFinding } from "../pathfinding/PathFinder";
import { PathStatus, SteppingPathFinder } from "../pathfinding/types";
import { PseudoRandom } from "../PseudoRandom";
import { ShellExecution } from "./ShellExecution";

export class TankExecution implements Execution {
  private random: PseudoRandom;
  private tank: Unit;
  private mg: Game;
  private pathfinder: SteppingPathFinder<TileRef>;
  private lastShellAttack = 0;

  constructor(private input: (UnitParams<UnitType.Tank> & OwnerComp) | Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = PathFinding.Land(mg);
    this.random = new PseudoRandom(mg.ticks());
    if (isUnit(this.input)) {
      this.tank = this.input;
    } else {
      const spawn = this.input.owner.canBuild(
        UnitType.Tank,
        this.input.targetTile!,
      );
      if (spawn === false) {
        return;
      }
      this.tank = this.input.owner.buildUnit(UnitType.Tank, spawn, this.input);
    }
  }

  tick(ticks: number): void {
    if (this.tank.health() <= 0) {
      this.tank.delete();
      return;
    }

    // Tanks heal slowly if on friendly territory
    const owner = this.mg.owner(this.tank.tile());
    if (
      owner.isPlayer() &&
      (owner === this.tank.owner() || owner.isFriendly(this.tank.owner()))
    ) {
      if (ticks % 10 === 0) {
        this.tank.modifyHealth(1);
      }
    }

    this.tank.setTargetUnit(this.findTargetUnit());

    if (this.tank.targetUnit() !== undefined) {
      this.shootTarget();
    } else {
      this.moveTowardsTarget();
    }
  }

  private findTargetUnit(): Unit | undefined {
    const mg = this.mg;
    const owner = this.tank.owner();

    // Tanks can target other ground units and structures
    const targets = mg.nearbyUnits(
      this.tank.tile(),
      30, // Tank range
      [UnitType.Tank, UnitType.City, UnitType.Factory, UnitType.DefensePost],
    );

    let bestUnit: Unit | undefined = undefined;
    let bestDistSquared = Infinity;

    for (const { unit, distSquared } of targets) {
      if (
        unit.owner() === owner ||
        unit === this.tank ||
        !owner.canAttackPlayer(unit.owner(), true)
      ) {
        continue;
      }

      if (distSquared < bestDistSquared) {
        bestUnit = unit;
        bestDistSquared = distSquared;
      }
    }

    return bestUnit;
  }

  private shootTarget() {
    const shellAttackRate = 50; // Tank fire rate
    if (this.mg.ticks() - this.lastShellAttack > shellAttackRate) {
      this.lastShellAttack = this.mg.ticks();
      this.mg.addExecution(
        new ShellExecution(
          this.tank.tile(),
          this.tank.owner(),
          this.tank,
          this.tank.targetUnit()!,
        ),
      );
    }
  }

  private moveTowardsTarget() {
    if (this.tank.targetTile() === undefined) {
      return;
    }

    const result = this.pathfinder.next(
      this.tank.tile(),
      this.tank.targetTile()!,
    );

    switch (result.status) {
      case PathStatus.COMPLETE:
        this.tank.setTargetTile(undefined);
        this.tank.move(result.node);
        break;
      case PathStatus.NEXT:
        this.tank.move(result.node);
        break;
      case PathStatus.PENDING:
        this.tank.touch();
        break;
    }
  }

  isActive(): boolean {
    return this.tank?.isActive();
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
