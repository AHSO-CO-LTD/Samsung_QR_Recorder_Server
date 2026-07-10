import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { HeartbeatDto } from "./dto/heartbeat.dto";
import { AckMachineCommandDto, CreateMachineCommandDto, CreateMachineDto, UpdateMachineDto } from "./dto/machine-crud.dto";

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

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

  async createMachine(dto: CreateMachineDto, actorUserId?: number | null) {
    const machine = await this.prisma.machine.create({
      data: {
        machine_code: dto.machine_code.trim(),
        machine_name: dto.machine_name.trim(),
        line_name: dto.line_name?.trim() || null,
        station_name: dto.station_name?.trim() || null,
        ip_address: dto.ip_address?.trim() || null,
        is_active: dto.is_active ?? true
      },
      include: {
        sync_state: true
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_MACHINE",
      tableName: "machines",
      recordId: machine.id,
      newValue: machine
    });

    return {
      success: true,
      code: "MACHINE_CREATED",
      message: "Machine created.",
      data: machine
    };
  }

  async updateMachine(id: number, dto: UpdateMachineDto, actorUserId?: number | null) {
    const oldMachine = await this.ensureMachineById(id);

    const machine = await this.prisma.machine.update({
      where: { id },
      data: {
        machine_name: dto.machine_name?.trim(),
        line_name: dto.line_name === undefined ? undefined : dto.line_name?.trim() || null,
        station_name: dto.station_name === undefined ? undefined : dto.station_name?.trim() || null,
        ip_address: dto.ip_address === undefined ? undefined : dto.ip_address?.trim() || null,
        is_active: dto.is_active
      },
      include: {
        sync_state: true
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_MACHINE",
      tableName: "machines",
      recordId: machine.id,
      oldValue: oldMachine,
      newValue: machine
    });

    return {
      success: true,
      code: "MACHINE_UPDATED",
      message: "Machine updated.",
      data: machine
    };
  }

  async deactivateMachine(id: number, actorUserId?: number | null) {
    const oldMachine = await this.ensureMachineById(id);
    const machine = await this.prisma.machine.update({
      where: { id },
      data: { is_active: false },
      include: {
        sync_state: true
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "DEACTIVATE_MACHINE",
      tableName: "machines",
      recordId: machine.id,
      oldValue: oldMachine,
      newValue: machine
    });

    return {
      success: true,
      code: "MACHINE_DEACTIVATED",
      message: "Machine deactivated.",
      data: machine
    };
  }

  async getMachineConfig(machineCode: string) {
    const machine = await this.ensureActiveMachine(machineCode);
    const [settings, profiles, pendingCommands] = await Promise.all([
      this.prisma.serverSetting.findFirst({
        orderBy: { id: "asc" }
      }),
      this.prisma.productProfile.findMany({
        where: { is_active: true },
        orderBy: [{ chassis_code: { code_full: "asc" } }, { id: "asc" }],
        include: {
          chassis_code: true,
          vendor: true,
          profile_led_codes: {
            include: {
              led_code: true
            },
            orderBy: {
              led_slot: "asc"
            }
          }
        }
      }),
      this.prisma.machineCommand.findMany({
        where: {
          machine_id: machine.id,
          status: {
            in: ["PENDING", "SENT"]
          }
        },
        take: 20,
        orderBy: { created_at: "asc" }
      })
    ]);

    return {
      success: true,
      code: "MACHINE_CONFIG_LOADED",
      message: "Machine server configuration loaded.",
      data: {
        machine,
        settings,
        profiles,
        pending_commands: pendingCommands
      }
    };
  }

  async listCommands(machineId: number, take: number) {
    await this.ensureMachineById(machineId);
    const commands = await this.prisma.machineCommand.findMany({
      where: { machine_id: machineId },
      take: Math.min(Math.max(take || 50, 1), 200),
      orderBy: { created_at: "desc" },
      include: {
        machine: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            full_name: true,
            role: true
          }
        }
      }
    });

    return {
      success: true,
      code: "MACHINE_COMMANDS_LISTED",
      message: "Machine commands loaded.",
      data: commands
    };
  }

  async createCommand(machineId: number, dto: CreateMachineCommandDto, actorUserId?: number | null) {
    await this.ensureMachineById(machineId);
    const command = await this.prisma.machineCommand.create({
      data: {
        machine_id: machineId,
        command_type: dto.command_type,
        payload_json: dto.payload_json === undefined ? undefined : JSON.parse(JSON.stringify(dto.payload_json)),
        created_by: dto.created_by ?? actorUserId ?? null
      },
      include: {
        machine: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            full_name: true,
            role: true
          }
        }
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_MACHINE_COMMAND",
      tableName: "machine_commands",
      recordId: command.id,
      newValue: command
    });

    return {
      success: true,
      code: "MACHINE_COMMAND_CREATED",
      message: "Machine command created.",
      data: command
    };
  }

  async pollCommands(machineCode: string, take: number) {
    const machine = await this.ensureActiveMachine(machineCode);
    const limit = Math.min(Math.max(take || 20, 1), 100);

    await this.prisma.machineCommand.updateMany({
      where: {
        machine_id: machine.id,
        status: "PENDING"
      },
      data: {
        status: "SENT",
        sent_at: new Date()
      }
    });

    const commands = await this.prisma.machineCommand.findMany({
      where: {
        machine_id: machine.id,
        status: "SENT"
      },
      take: limit,
      orderBy: { created_at: "asc" }
    });

    return {
      success: true,
      code: "MACHINE_COMMANDS_POLLED",
      message: "Pending machine commands loaded.",
      data: commands
    };
  }

  async ackCommand(commandId: number, dto: AckMachineCommandDto) {
    const machine = await this.ensureActiveMachine(dto.machine_code);
    const command = await this.prisma.machineCommand.findFirst({
      where: {
        id: commandId,
        machine_id: machine.id
      }
    });

    if (!command) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_COMMAND_NOT_FOUND",
        message: "Machine command was not found for this machine."
      });
    }

    const updatedCommand = await this.prisma.machineCommand.update({
      where: { id: commandId },
      data: {
        status: dto.status,
        ack_at: dto.status === "ACK" ? new Date() : null,
        error_message: dto.error_message ?? null
      }
    });

    return {
      success: true,
      code: dto.status === "ACK" ? "MACHINE_COMMAND_ACKED" : "MACHINE_COMMAND_FAILED",
      message: dto.status === "ACK" ? "Machine command acknowledged." : "Machine command marked as failed.",
      data: updatedCommand
    };
  }

  async heartbeat(dto: HeartbeatDto) {
    const machine = await this.ensureActiveMachine(dto.machine_code);

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

  private async ensureMachineById(id: number) {
    const machine = await this.prisma.machine.findUnique({
      where: { id }
    });

    if (!machine) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_NOT_FOUND",
        message: "Machine was not found."
      });
    }

    return machine;
  }

  private async ensureActiveMachine(machineCode: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { machine_code: machineCode }
    });

    if (!machine || !machine.is_active) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_NOT_FOUND",
        message: "Machine code does not exist or is inactive."
      });
    }

    return machine;
  }
}
