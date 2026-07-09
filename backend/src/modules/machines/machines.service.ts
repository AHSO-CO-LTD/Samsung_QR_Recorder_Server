import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { HeartbeatDto } from "./dto/heartbeat.dto";

@Injectable()
export class MachinesService {
  constructor(private readonly prisma: PrismaService) {}

  async listMachines() {
    const machines = await this.prisma.machine.findMany({
      orderBy: [{ is_active: "desc" }, { machine_code: "asc" }],
      include: {
        sync_state: true
      }
    });

    return {
      success: true,
      code: "MACHINES_LISTED",
      message: "Machines loaded.",
      data: machines
    };
  }

  async heartbeat(dto: HeartbeatDto) {
    const machine = await this.prisma.machine.findUnique({
      where: { machine_code: dto.machine_code }
    });

    if (!machine || !machine.is_active) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_NOT_FOUND",
        message: "Machine code does not exist or is inactive."
      });
    }

    const now = new Date();
    const syncState = await this.prisma.machineSyncState.upsert({
      where: { machine_id: machine.id },
      create: {
        machine_id: machine.id,
        machine_code: machine.machine_code,
        connection_status: "ONLINE",
        last_seen_at: now,
        last_ip_address: dto.ip_address,
        local_total_record: dto.local_total_record ?? 0,
        local_ok_record: dto.local_ok_record ?? 0,
        local_ng_record: dto.local_ng_record ?? 0,
        local_pending_sync: dto.local_pending_sync ?? 0,
        local_checksum: dto.local_checksum,
        app_version: dto.app_version,
        local_db_version: dto.local_db_version
      },
      update: {
        connection_status: "ONLINE",
        last_seen_at: now,
        last_ip_address: dto.ip_address,
        local_total_record: dto.local_total_record ?? undefined,
        local_ok_record: dto.local_ok_record ?? undefined,
        local_ng_record: dto.local_ng_record ?? undefined,
        local_pending_sync: dto.local_pending_sync ?? undefined,
        local_checksum: dto.local_checksum,
        app_version: dto.app_version,
        local_db_version: dto.local_db_version
      }
    });

    await this.prisma.machineConnectionLog.create({
      data: {
        machine_id: machine.id,
        machine_code: machine.machine_code,
        event_type: "HEARTBEAT",
        ip_address: dto.ip_address,
        message: "Heartbeat received from local machine.",
        payload_json: JSON.parse(JSON.stringify(dto))
      }
    });

    return {
      success: true,
      code: "HEARTBEAT_ACCEPTED",
      message: "Heartbeat accepted.",
      data: {
        machine,
        sync_state: syncState
      }
    };
  }
}
