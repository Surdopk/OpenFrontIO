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

export class PlaneExecution implements Execution {
  private random: PseudoRandom;
  private plane: Unit;
  private mg: Game;
  private pathfinder: SteppingPathFinder<TileRef>;
  private lastShellAttack = 0;

  constructor(private input: (UnitParams<UnitType.Plane> & OwnerComp) | Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.pathfinder = PathFinding.Air(mg);
    this.random = new PseudoRandom(mg.ticks());
    if (isUnit(this.input)) {
      this.plane = this.input;
    } else {
      const spawn = this.input.owner.canBuild(
        UnitType.Plane,
        this.input.targetTile!,
      );
      if (spawn === false) {
        return;
      }
      this.plane = this.input.owner.buildUnit(
        UnitType.Plane,
        spawn,
        this.input,
      );
    }
  }

  tick(ticks: number): void {
    if (this.plane.health() <= 0) {
      this.plane.delete();
      return;
    }

    // Planes don't heal in the air
    this.plane.setTargetUnit(this.findTargetUnit());

    if (this.plane.targetUnit() !== undefined) {
      this.shootTarget();
    }

    this.move();
  }

  private findTargetUnit(): Unit | undefined {
    const mg = this.mg;
    const owner = this.plane.owner();

    // Planes can target anything
    const targets = mg.nearbyUnits(
      this.plane.tile(),
      50, // Plane range
      [
        UnitType.Tank,
        UnitType.Warship,
        UnitType.City,
        UnitType.Factory,
        UnitType.DefensePost,
      ],
    );

    let bestUnit: Unit | undefined = undefined;
    let bestDistSquared = Infinity;

    for (const { unit, distSquared } of targets) {
      if (
        unit.owner() === owner ||
        unit === this.plane ||
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
    const shellAttackRate = 30; // Plane fire rate (faster than tank)
    if (this.mg.ticks() - this.lastShellAttack > shellAttackRate) {
      this.lastShellAttack = this.mg.ticks();
      this.mg.addExecution(
        new ShellExecution(
          this.plane.tile(),
          this.plane.owner(),
          this.plane,
          this.plane.targetUnit()!,
        ),
      );
    }
  }

  private move() {
    const target = this.plane.targetTile() ?? this.plane.patrolTile();

    if (target === undefined) {
      return;
    }

    // Planes move faster (3 steps per tick)
    for (let i = 0; i < 3; i++) {
      const result = this.pathfinder.next(this.plane.tile(), target);

      switch (result.status) {
        case PathStatus.COMPLETE:
          if (this.plane.targetTile() !== undefined) {
            this.plane.setTargetTile(undefined);
          }
          this.plane.move(result.node);
          return;
        case PathStatus.NEXT:
          this.plane.move(result.node);
          break;
        case PathStatus.PENDING:
          this.plane.touch();
          return;
      }
    }
  }

  isActive(): boolean {
    return this.plane?.isActive();
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
