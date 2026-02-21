import { GameMap } from "../../game/GameMap";
import { DebugSpan } from "../../utilities/DebugSpan";
import { PathFinder } from "../types";
import { AStar, AStarAdapter } from "./AStar";

export class AStarLand implements PathFinder<number> {
  private readonly aStar: AStar;

  constructor(gameMap: GameMap) {
    const adapter = new LandAdapter(gameMap);
    this.aStar = new AStar({ adapter });
  }

  findPath(from: number | number[], to: number): number[] | null {
    return DebugSpan.wrap("AStar.Land:findPath", () =>
      this.aStar.findPath(from, to),
    );
  }
}

class LandAdapter implements AStarAdapter {
  private readonly gameMap: GameMap;
  private readonly width: number;
  private readonly height: number;
  private readonly _numNodes: number;
  private readonly waterPenalty = 100;
  private readonly heuristicWeight = 2;

  constructor(gameMap: GameMap) {
    this.gameMap = gameMap;
    this.width = gameMap.width();
    this.height = gameMap.height();
    this._numNodes = this.width * this.height;
  }

  numNodes(): number {
    return this._numNodes;
  }

  maxNeighbors(): number {
    return 4;
  }

  maxPriority(): number {
    return (
      this.heuristicWeight *
      (this.width + this.height) *
      (1 + this.waterPenalty)
    );
  }

  neighbors(node: number, buffer: Int32Array): number {
    let count = 0;
    const x = node % this.width;

    if (node >= this.width) {
      const n = node - this.width;
      if (this.isTraversable(n)) buffer[count++] = n;
    }
    if (node < this._numNodes - this.width) {
      const n = node + this.width;
      if (this.isTraversable(n)) buffer[count++] = n;
    }
    if (x !== 0) {
      const n = node - 1;
      if (this.isTraversable(n)) buffer[count++] = n;
    }
    if (x !== this.width - 1) {
      const n = node + 1;
      if (this.isTraversable(n)) buffer[count++] = n;
    }

    return count;
  }

  private isTraversable(to: number): boolean {
    // Tanks can only move on land
    return this.gameMap.isLand(to);
  }

  cost(from: number, to: number, prev?: number): number {
    return 1;
  }

  heuristic(node: number, goal: number): number {
    const nx = node % this.width;
    const ny = (node / this.width) | 0;
    const gx = goal % this.width;
    const gy = (goal / this.width) | 0;
    return this.heuristicWeight * (Math.abs(nx - gx) + Math.abs(ny - gy));
  }
}
