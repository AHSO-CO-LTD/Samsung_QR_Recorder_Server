import { Injectable } from "@nestjs/common";

@Injectable()
export class RuntimeConnectionRegistry {
  private readonly socketIdsByMachine = new Map<number, Set<string>>();

  connect(machineId: number, socketId: string) {
    const socketIds = this.socketIdsByMachine.get(machineId) ?? new Set<string>();
    socketIds.add(socketId);
    this.socketIdsByMachine.set(machineId, socketIds);
  }

  disconnect(machineId: number, socketId: string) {
    const socketIds = this.socketIdsByMachine.get(machineId);
    if (!socketIds) {
      return true;
    }

    socketIds.delete(socketId);
    if (socketIds.size > 0) {
      return false;
    }

    this.socketIdsByMachine.delete(machineId);
    return true;
  }

  hasConnection(machineId: number) {
    return (this.socketIdsByMachine.get(machineId)?.size ?? 0) > 0;
  }
}
