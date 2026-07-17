import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import { HeartbeatDto } from "./dto/heartbeat.dto";
import {
  AckMachineCommandDto,
  ApproveMachineRegistrationRequestDto,
  CheckMachineRegistrationStatusQueryDto,
  CreateMachineCommandDto,
  CreateMachineDto,
  CreateMachineRegistrationRequestDto,
  ImportMachineRegistrationLicenseDto,
  RejectMachineRegistrationRequestDto,
  ResolveMachineIdentityQueryDto,
  UpdateMachineDto
} from "./dto/machine-crud.dto";

type MachineIdentity = {
  serial: string;
  uid: string;
};

type IdentityDuplicate = {
  field: "serial" | "uid" | "machine_code";
  value: string;
  source: "machine" | "registration_request";
  machine_code?: string | null;
  request_id?: string | null;
  status?: string | null;
};

const MIN_HEARTBEAT_DISCONNECT_SECONDS = 5 * 60;
const HEARTBEAT_STALE_SWEEP_INTERVAL_MS = 30 * 1000;

@Injectable()
export class MachinesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MachinesService.name);
  private heartbeatSweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  onModuleInit() {
    void this.markStaleHeartbeatMachinesOffline().catch((error) => this.logger.warn(`Initial heartbeat stale sweep failed: ${this.formatError(error)}`));
    this.heartbeatSweepTimer = setInterval(() => {
      void this.markStaleHeartbeatMachinesOffline().catch((error) => this.logger.warn(`Heartbeat stale sweep failed: ${this.formatError(error)}`));
    }, HEARTBEAT_STALE_SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.heartbeatSweepTimer) {
      clearInterval(this.heartbeatSweepTimer);
      this.heartbeatSweepTimer = undefined;
    }
  }

  async listMachines() {
    await this.markStaleHeartbeatMachinesOffline();
    const machines = await this.prisma.machine.findMany({
      orderBy: [{ is_active: "desc" }, { machine_code: "asc" }],
      include: {
        sync_state: true,
        _count: {
          select: {
            scan_records: true
          }
        }
      }
    });

    return {
      success: true,
      code: "MACHINES_LISTED",
      message: "Đã tải danh sách máy.",
      data: machines
    };
  }

  async createMachine(dto: CreateMachineDto, actorUserId?: number | null) {
    const machine = await this.prisma.machine.create({
      data: {
        machine_code: dto.machine_code.trim(),
        machine_name: dto.machine_name.trim(),
        line_name: this.optionalTrim(dto.line_name),
        station_name: this.optionalTrim(dto.station_name),
        ip_address: this.optionalTrim(dto.ip_address),
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
      message: "Đã tạo máy.",
      data: machine
    };
  }

  async updateMachine(id: number, dto: UpdateMachineDto, actorUserId?: number | null) {
    const oldMachine = await this.ensureMachineById(id);

    const machine = await this.prisma.machine.update({
      where: { id },
      data: {
        machine_name: dto.machine_name?.trim(),
        line_name: dto.line_name === undefined ? undefined : this.optionalTrim(dto.line_name),
        station_name: dto.station_name === undefined ? undefined : this.optionalTrim(dto.station_name),
        ip_address: dto.ip_address === undefined ? undefined : this.optionalTrim(dto.ip_address),
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
      message: "Đã cập nhật máy.",
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
      message: "Đã vô hiệu hóa máy.",
      data: machine
    };
  }

  async deleteMachineIfNoScans(id: number, actorUserId?: number | null) {
    const oldMachine = await this.ensureMachineById(id);
    const [scanCount, recentDuplicateCount] = await Promise.all([
      this.prisma.scanRecord.count({
        where: { machine_id: id }
      }),
      this.prisma.recentDuplicateKey.count({
        where: { first_machine_id: id }
      })
    ]);

    if (scanCount > 0 || recentDuplicateCount > 0) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_HAS_SCAN_RECORDS",
        message: "Máy đã có lịch sử quét nên không thể xóa vĩnh viễn. Hãy vô hiệu hóa máy thay vì xóa.",
        data: {
          scan_records: scanCount,
          recent_duplicate_keys: recentDuplicateCount
        }
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const relatedBatches = await tx.scanSyncBatch.count({
        where: { machine_id: id }
      });
      const relatedRegistrationRequests = await tx.machineRegistrationRequest.count({
        where: this.buildMachineRegistrationDeleteWhere(oldMachine)
      });

      await tx.scanSyncBatch.deleteMany({
        where: { machine_id: id }
      });
      await tx.machineRegistrationRequest.deleteMany({
        where: this.buildMachineRegistrationDeleteWhere(oldMachine)
      });
      const deletedMachine = await tx.machine.delete({
        where: { id }
      });

      return {
        deletedMachine,
        relatedBatches,
        relatedRegistrationRequests
      };
    });

    await this.audit.write({
      userId: actorUserId,
      action: "DELETE_MACHINE",
      tableName: "machines",
      recordId: oldMachine.id,
      oldValue: {
        ...oldMachine,
        deleted_scan_sync_batches: result.relatedBatches,
        deleted_registration_requests: result.relatedRegistrationRequests
      }
    });

    return {
      success: true,
      code: "MACHINE_DELETED",
      message: "Đã xóa vĩnh viễn máy.",
      data: {
        machine: result.deletedMachine,
        deleted_scan_sync_batches: result.relatedBatches,
        deleted_registration_requests: result.relatedRegistrationRequests
      }
    };
  }

  async markStaleHeartbeatMachinesOffline(now = new Date()) {
    const timeoutSeconds = await this.resolveHeartbeatDisconnectSeconds();
    const cutoff = new Date(now.getTime() - timeoutSeconds * 1000);
    const staleStates = await this.prisma.machineSyncState.findMany({
      where: {
        connection_status: "ONLINE",
        OR: [{ last_seen_at: null }, { last_seen_at: { lt: cutoff } }],
        machine: {
          is: {
            is_active: true
          }
        }
      },
      select: {
        id: true,
        machine_id: true,
        machine_code: true,
        last_seen_at: true,
        last_ip_address: true
      }
    });

    if (staleStates.length === 0) {
      return {
        updated: 0,
        cutoff
      };
    }

    const syncStateIds = staleStates.map((state) => state.id);
    const machineIds = [...new Set(staleStates.map((state) => state.machine_id))];
    const staleByMachineId = new Map(staleStates.map((state) => [state.machine_id, state]));

    const result = await this.prisma.$transaction(async (tx) => {
      const runningSessions = await tx.machineRuntimeSession.findMany({
        where: {
          machine_id: {
            in: machineIds
          },
          status: "RUNNING"
        },
        select: {
          id: true,
          machine_id: true,
          machine_code: true,
          current_product_id: true
        }
      });

      const updatedStates = await tx.machineSyncState.updateMany({
        where: {
          id: {
            in: syncStateIds
          },
          connection_status: "ONLINE",
          OR: [{ last_seen_at: null }, { last_seen_at: { lt: cutoff } }]
        },
        data: {
          connection_status: "OFFLINE"
        }
      });

      await tx.machineConnectionLog.createMany({
        data: staleStates.map((state) => ({
          machine_id: state.machine_id,
          machine_code: state.machine_code,
          event_type: "DISCONNECTED",
          ip_address: state.last_ip_address,
        message: `Không nhận được nhịp kết nối trong ${timeoutSeconds} giây. Máy đã được đánh dấu mất kết nối.`,
          payload_json: JSON.parse(
            JSON.stringify({
              reason: "HEARTBEAT_TIMEOUT",
              timeout_seconds: timeoutSeconds,
              last_seen_at: state.last_seen_at,
              disconnected_at: now
            })
          )
        }))
      });

      const updatedSessions = await tx.machineRuntimeSession.updateMany({
        where: {
          id: {
            in: runningSessions.map((session) => session.id)
          },
          status: "RUNNING"
        },
        data: {
          status: "DISCONNECTED",
          disconnected_at: now,
          ended_at: now,
          last_seen_at: now
        }
      });

      if (runningSessions.length > 0) {
        await tx.machineRuntimeProduct.updateMany({
          where: {
            session_id: {
              in: runningSessions.map((session) => session.id)
            },
            ended_at: null
          },
          data: {
            ended_at: now
          }
        });

        await tx.machineRuntimeEvent.createMany({
          data: runningSessions.map((session) => {
            const staleState = staleByMachineId.get(session.machine_id);
            return {
              session_id: session.id,
              product_id: session.current_product_id,
              machine_id: session.machine_id,
              machine_code: session.machine_code,
              event_type: "SOCKET_DISCONNECTED",
              ip_address: staleState?.last_ip_address ?? null,
              payload_json: JSON.parse(
                JSON.stringify({
                  reason: "HEARTBEAT_TIMEOUT",
                  timeout_seconds: timeoutSeconds,
                  last_seen_at: staleState?.last_seen_at,
                  disconnected_at: now
                })
              )
            };
          })
        });
      }

      return {
        states: updatedStates.count,
        sessions: updatedSessions.count
      };
    });

    return {
      updated: result.states,
      sessions: result.sessions,
      cutoff
    };
  }

  async createRegistrationRequest(dto: CreateMachineRegistrationRequestDto, requestIp?: string | null) {
    const serial = this.requiredTrim(dto.serial, "serial");
    const uid = this.requiredTrim(dto.uid, "uid");
    const licenseKey = `${serial}|${uid}`;
    const ipAddress = this.optionalTrim(requestIp) ?? this.optionalTrim(dto.ip_address) ?? "UNKNOWN";
    const duplicates = await this.findIdentityDuplicates({
      serial,
      uid
    });

    if (duplicates.length > 0) {
      await this.notifications.createEvent({
        notiCode: "MACHINE_REGISTER_DUPLICATE",
        title: "Yêu cầu định danh máy bị trùng",
        titleVi: "Yêu cầu định danh máy bị trùng",
        titleEn: "Duplicated machine registration request",
        message: `Một máy cục bộ gửi trường định danh bị trùng. Seri: ${serial}, UID: ${uid}. IP phát hiện: ${ipAddress}.`,
        messageVi: `Máy cục bộ gửi thông tin định danh bị trùng. Seri: ${serial}, UID: ${uid}. IP phát hiện: ${ipAddress}.`,
        messageEn: `A local machine sent duplicated identity fields. Serial: ${serial}, UID: ${uid}. Detected IP: ${ipAddress}.`,
        payload: {
          serial,
          uid,
          ip_address: ipAddress
        },
        severity: "WARNING",
        errorCode: "MACHINE_REGISTER_DUPLICATE"
      });

      throw new ConflictException({
        success: false,
        code: "MACHINE_REGISTER_DUPLICATE",
        message: "Yêu cầu đăng ký máy có trường định danh bị trùng.",
        data: {
          status: "DUPLICATE",
          duplicates
        }
      });
    }

    const request = await this.prisma.machineRegistrationRequest.create({
      data: {
        request_id: this.buildRegistrationRequestId(),
        serial,
        uid,
        license_key_raw: licenseKey,
        ip_address: ipAddress,
        status: "PENDING",
        raw_json: JSON.parse(
          JSON.stringify({
            ...dto,
            detected_ip_address: ipAddress
          })
        )
      }
    });

    await this.notifications.createEvent({
      notiCode: "MACHINE_REGISTER_REQUEST",
      title: "Yêu cầu định danh máy cục bộ mới",
      titleVi: "Yêu cầu định danh máy cục bộ mới",
      titleEn: "New local machine identification request",
      message: `Máy cục bộ yêu cầu định danh. Seri: ${request.serial}, UID: ${request.uid}, IP: ${request.ip_address}.`,
      messageVi: `Máy cục bộ yêu cầu định danh. Seri: ${request.serial}, UID: ${request.uid}, IP: ${request.ip_address}.`,
      messageEn: `A local machine requested identification. Serial: ${request.serial}, UID: ${request.uid}, IP: ${request.ip_address}.`,
      payload: {
        request_id: request.request_id,
        serial: request.serial,
        uid: request.uid,
        ip_address: request.ip_address
      },
      severity: "INFO"
    });

    return {
      success: true,
      code: "MACHINE_REGISTER_REQUEST_SENT",
      message: "Đã gửi yêu cầu đăng ký máy. Đang chờ máy chủ định danh.",
      data: {
        request_id: request.request_id,
        status: request.status,
        serial: request.serial,
        uid: request.uid,
        license_key_received: Boolean(request.license_key_raw),
        ip_address: request.ip_address,
        requested_machine_code: request.requested_machine_code,
        created_at: request.created_at
      }
    };
  }

  async getRegistrationRequestStatus(requestId: string, query: CheckMachineRegistrationStatusQueryDto) {
    const request = await this.prisma.machineRegistrationRequest.findUnique({
      where: { request_id: requestId },
      include: {
        approved_machine: true
      }
    });

    if (!request) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_REGISTER_REQUEST_NOT_FOUND",
        message: "Không tìm thấy yêu cầu đăng ký máy."
      });
    }

    if (request.serial !== this.requiredTrim(query.serial, "serial") || request.uid !== this.requiredTrim(query.uid, "uid")) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_REGISTER_IDENTITY_MISMATCH",
        message: "Seri hoặc UID không khớp yêu cầu đăng ký này."
      });
    }

    const statusCode =
      request.status === "APPROVED"
        ? "MACHINE_REGISTER_APPROVED"
        : request.status === "REJECTED"
          ? "MACHINE_REGISTER_REJECTED"
          : "MACHINE_REGISTER_PENDING";

    const message =
      request.status === "APPROVED"
        ? "Yêu cầu đăng ký máy đã được duyệt."
        : request.status === "REJECTED"
          ? "Yêu cầu đăng ký máy đã bị từ chối."
          : "Yêu cầu đăng ký máy đang chờ máy chủ định danh.";

    return {
      success: true,
      code: statusCode,
      message,
      data: {
        request_id: request.request_id,
        status: request.status,
        machine_code: request.approved_machine_code ?? request.approved_machine?.machine_code ?? null,
        serial: request.serial,
        uid: request.uid,
        ip_address: request.ip_address,
        license_activated_at: request.license_activated_at,
        rejected_reason: request.rejected_reason,
        approved_at: request.approved_at,
        rejected_at: request.rejected_at
      }
    };
  }

  async getMachineIdentityStatus(query: ResolveMachineIdentityQueryDto) {
    const serial = this.requiredTrim(query.serial, "serial");
    const uid = this.requiredTrim(query.uid, "uid");

    const exactMachine = await this.prisma.machine.findFirst({
      where: {
        serial,
        uid
      },
      include: {
        sync_state: true
      }
    });

    if (exactMachine) {
      return {
        success: true,
        code: exactMachine.is_active ? "MACHINE_IDENTITY_APPROVED" : "MACHINE_IDENTITY_DISABLED",
        message: exactMachine.is_active ? "Đã tìm thấy và duyệt định danh máy." : "Định danh máy tồn tại nhưng đã bị tắt.",
        data: {
          status: exactMachine.is_active ? "APPROVED" : "DISABLED",
          machine_code: exactMachine.machine_code,
          machine: exactMachine,
          serial,
          uid
        }
      };
    }

    const partialMachines = await this.prisma.machine.findMany({
      where: {
        OR: [{ serial }, { uid }]
      },
      select: {
        machine_code: true,
        serial: true,
        uid: true,
        is_active: true
      }
    });

    if (partialMachines.length > 0) {
      throw new ConflictException({
        success: false,
        code: "MACHINE_IDENTITY_MISMATCH",
        message: "Seri hoặc UID đã được gán cho định danh máy khác.",
        data: {
          status: "MISMATCH",
          matches: partialMachines
        }
      });
    }

    const request = await this.prisma.machineRegistrationRequest.findFirst({
      where: {
        serial,
        uid
      },
      orderBy: {
        created_at: "desc"
      },
      include: {
        approved_machine: true
      }
    });

    if (request) {
      const statusCode =
        request.status === "APPROVED"
          ? "MACHINE_REGISTER_APPROVED"
          : request.status === "REJECTED"
            ? "MACHINE_REGISTER_REJECTED"
            : "MACHINE_REGISTER_PENDING";

      return {
        success: true,
        code: statusCode,
        message:
          request.status === "APPROVED"
            ? "Yêu cầu đăng ký máy đã được duyệt."
            : request.status === "REJECTED"
              ? "Yêu cầu đăng ký máy đã bị từ chối."
              : "Yêu cầu đăng ký máy đang chờ máy chủ định danh.",
        data: {
          status: request.status,
          request_id: request.request_id,
          machine_code: request.approved_machine_code ?? request.approved_machine?.machine_code ?? null,
          machine: request.approved_machine,
          serial,
          uid,
          license_activated_at: request.license_activated_at,
          rejected_reason: request.rejected_reason
        }
      };
    }

    return {
      success: true,
      code: "MACHINE_IDENTITY_NOT_REGISTERED",
      message: "Định danh máy chưa được đăng ký trên máy chủ.",
      data: {
        status: "NOT_REGISTERED",
        machine_code: null,
        request_id: null,
        serial,
        uid
      }
    };
  }

  async listRegistrationRequests(take: number, status?: "PENDING" | "APPROVED" | "REJECTED") {
    const requests = await this.prisma.machineRegistrationRequest.findMany({
      where: status ? { status } : undefined,
      take: Math.min(Math.max(take || 50, 1), 200),
      orderBy: { created_at: "desc" },
      include: {
        approved_machine: true
      }
    });

    return {
      success: true,
      code: "MACHINE_REGISTER_REQUESTS_LISTED",
      message: "Đã tải yêu cầu đăng ký máy.",
      data: requests
    };
  }

  async exportRegistrationLicenseInfo(id: number) {
    const request = await this.ensureRegistrationRequestById(id);
    const exportedAt = new Date().toISOString();
    const fileName = `machine-license-request-${request.request_id}.json`;
    const content = {
      license_format: "SAMSUNG_QR_MACHINE_INFO_RAW_V1",
      request_id: request.request_id,
      requested_machine_code: request.requested_machine_code,
      serial: request.serial,
      uid: request.uid,
      raw_license_key: request.license_key_raw ?? `${request.serial}|${request.uid}`,
      ip_address: request.ip_address,
      hostname: request.hostname,
      app_version: request.app_version,
      local_db_version: request.local_db_version,
      exported_at: exportedAt
    };

    return {
      success: true,
      code: "MACHINE_LICENSE_INFO_EXPORTED",
      message: "Đã tạo nội dung tệp định danh máy.",
      data: {
        file_name: fileName,
        content
      }
    };
  }

  async importRegistrationLicense(id: number, dto: ImportMachineRegistrationLicenseDto, actorUserId?: number | null) {
    const oldRequest = await this.ensureRegistrationRequestById(id);

    if (oldRequest.status !== "PENDING") {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_REGISTER_REQUEST_NOT_PENDING",
        message: "Chỉ yêu cầu đăng ký đang chờ mới được nhập giấy phép."
      });
    }

    const license = this.readImportedLicense(dto);

    const activatedAt = new Date();
    const request = await this.prisma.machineRegistrationRequest.update({
      where: { id },
      data: {
        license_key_raw: license.licenseKey,
        license_file_json: JSON.parse(JSON.stringify(license.payload)),
        license_activated_at: activatedAt,
        license_activated_by: actorUserId ?? null
      }
    });

    await this.audit.write({
      userId: actorUserId,
      action: "IMPORT_MACHINE_REGISTRATION_LICENSE",
      tableName: "machine_registration_requests",
      recordId: request.id,
      oldValue: oldRequest,
      newValue: request
    });

    return {
      success: true,
      code: "MACHINE_LICENSE_ACTIVATED",
      message: "Đã nhập giấy phép máy. Yêu cầu đăng ký hiện có thể được duyệt.",
      data: {
        request_id: request.request_id,
        status: request.status,
        serial: request.serial,
        uid: request.uid,
        license_activated_at: request.license_activated_at
      }
    };
  }

  async approveRegistrationRequest(id: number, dto: ApproveMachineRegistrationRequestDto, actorUserId?: number | null) {
    const request = await this.prisma.machineRegistrationRequest.findUnique({
      where: { id }
    });

    if (!request) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_REGISTER_REQUEST_NOT_FOUND",
        message: "Không tìm thấy yêu cầu đăng ký máy."
      });
    }

    if (request.status !== "PENDING") {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_REGISTER_REQUEST_NOT_PENDING",
        message: "Chỉ yêu cầu đăng ký đang chờ mới được duyệt."
      });
    }

    if (!request.license_activated_at) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_LICENSE_NOT_IMPORTED",
        message: "Phải nhập giấy phép đăng ký máy trước khi duyệt."
      });
    }

    const machineCode = this.requiredTrim(dto.machine_code, "machine_code");
    const duplicates = await this.findIdentityDuplicates({
      serial: request.serial,
      uid: request.uid,
      requestedMachineCode: machineCode,
      excludeRegistrationRequestId: request.id
    });

    if (duplicates.length > 0) {
      throw new ConflictException({
        success: false,
        code: "MACHINE_REGISTER_DUPLICATE",
        message: "Định danh máy hoặc mã máy đã được sử dụng.",
        data: {
          status: "DUPLICATE",
          duplicates
        }
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const machine = await tx.machine.create({
        data: {
          machine_code: machineCode,
          machine_name: this.requiredTrim(dto.machine_name, "machine_name"),
          serial: request.serial,
          uid: request.uid,
          license_key_raw: request.license_key_raw,
          license_activated_at: request.license_activated_at,
          ip_address: request.ip_address,
          is_active: dto.is_active ?? true
        },
        include: {
          sync_state: true
        }
      });

      const updatedRequest = await tx.machineRegistrationRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          approved_machine_id: machine.id,
          approved_machine_code: machine.machine_code,
          approved_at: new Date()
        },
        include: {
          approved_machine: true
        }
      });

      return { machine, request: updatedRequest };
    });

    await this.audit.write({
      userId: actorUserId,
      action: "APPROVE_MACHINE_REGISTRATION_REQUEST",
      tableName: "machine_registration_requests",
      recordId: request.id,
      oldValue: request,
      newValue: result
    });

    return {
      success: true,
      code: "MACHINE_REGISTER_APPROVED",
      message: "Đã duyệt yêu cầu đăng ký và định danh máy.",
      data: result
    };
  }

  async rejectRegistrationRequest(id: number, dto: RejectMachineRegistrationRequestDto, actorUserId?: number | null) {
    const oldRequest = await this.prisma.machineRegistrationRequest.findUnique({
      where: { id }
    });

    if (!oldRequest) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_REGISTER_REQUEST_NOT_FOUND",
        message: "Không tìm thấy yêu cầu đăng ký máy."
      });
    }

    if (oldRequest.status !== "PENDING") {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_REGISTER_REQUEST_NOT_PENDING",
        message: "Chỉ yêu cầu đăng ký đang chờ mới được từ chối."
      });
    }

    const request = await this.prisma.machineRegistrationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejected_reason: this.requiredTrim(dto.reason, "reason"),
        rejected_at: new Date()
      }
    });

    await this.audit.write({
      userId: actorUserId,
      action: "REJECT_MACHINE_REGISTRATION_REQUEST",
      tableName: "machine_registration_requests",
      recordId: request.id,
      oldValue: oldRequest,
      newValue: request
    });

    return {
      success: true,
      code: "MACHINE_REGISTER_REJECTED",
      message: "Đã từ chối yêu cầu đăng ký máy.",
      data: request
    };
  }

  async getMachineConfigByIdentity(identity: MachineIdentity) {
    const machine = await this.ensureActiveMachineByIdentity(identity);
    return this.buildMachineConfigResponse(machine);
  }

  private async buildMachineConfigResponse(machine: { id: number }) {
    const [settings, profiles, vendors, pendingCommands] = await Promise.all([
      this.prisma.serverSetting.findFirst({
        orderBy: { id: "asc" }
      }),
      this.prisma.productProfile.findMany({
        where: { is_active: true },
        orderBy: [{ chassis_code: { code_full: "asc" } }, { id: "asc" }],
        include: {
          chassis_code: true,
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
      this.prisma.vendor.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ vendor_char: "asc" }, { vendor_name: "asc" }]
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
      message: "Đã tải cấu hình máy chủ cho máy.",
      data: {
        machine,
        settings,
        profiles,
        vendors,
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
      message: "Đã tải lệnh máy.",
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
      message: "Đã tạo lệnh máy.",
      data: command
    };
  }

  async pollCommandsByIdentity(take: number, identity: MachineIdentity) {
    const machine = await this.ensureActiveMachineByIdentity(identity);
    return this.pollCommandsForMachine(machine, take);
  }

  private async pollCommandsForMachine(machine: { id: number }, take: number) {
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
      message: "Đã tải lệnh máy đang chờ.",
      data: commands
    };
  }

  async ackCommand(commandId: number, dto: AckMachineCommandDto) {
    const machine = await this.ensureActiveMachineByIdentity({
      serial: dto.serial,
      uid: dto.uid
    });
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
        message: "Không tìm thấy lệnh cho máy này."
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

    await this.notifications.createEvent({
      notiCode: dto.status === "ACK" ? "LOCAL_POST_COMMAND_ACK" : "LOCAL_POST_COMMAND_FAILED",
      machineId: machine.id,
      title: dto.status === "ACK" ? "Máy đã xác nhận lệnh" : "Máy báo lệnh thất bại",
      titleVi: dto.status === "ACK" ? "Máy đã xác nhận lệnh" : "Máy báo lệnh thất bại",
      titleEn: dto.status === "ACK" ? "Machine command acknowledged" : "Machine command failed",
      message:
        dto.status === "ACK"
          ? `Máy ${machine.machine_code} đã xác nhận lệnh #${commandId}.`
          : `Máy ${machine.machine_code} báo lệnh #${commandId} thất bại${dto.error_message ? `: ${dto.error_message}` : "."}`,
      messageVi:
        dto.status === "ACK"
          ? `Máy ${machine.machine_code} đã xác nhận lệnh #${commandId}.`
          : `Máy ${machine.machine_code} báo lệnh #${commandId} thất bại${dto.error_message ? `: ${dto.error_message}` : "."}`,
      messageEn:
        dto.status === "ACK"
          ? `Machine ${machine.machine_code} acknowledged command #${commandId}.`
          : `Machine ${machine.machine_code} marked command #${commandId} as failed${dto.error_message ? `: ${dto.error_message}` : "."}`,
      payload: {
        machine_code: machine.machine_code,
        command_id: commandId,
        status: dto.status,
        error_message: dto.error_message ?? null
      },
      severity: dto.status === "ACK" ? "INFO" : "WARNING",
      errorCode: dto.status === "ACK" ? null : "MACHINE_COMMAND_FAILED"
    });

    return {
      success: true,
      code: dto.status === "ACK" ? "MACHINE_COMMAND_ACKED" : "MACHINE_COMMAND_FAILED",
      message: dto.status === "ACK" ? "Máy đã xác nhận lệnh." : "Lệnh máy đã được đánh dấu thất bại.",
      data: updatedCommand
    };
  }

  async heartbeat(dto: HeartbeatDto, requestIp?: string | null) {
    const machine = await this.ensureActiveMachineIdentity(dto.machine_code, {
      serial: dto.serial,
      uid: dto.uid
    });
    const detectedIpAddress = this.optionalTrim(requestIp) ?? this.optionalTrim(dto.ip_address);
    const currentMachine = detectedIpAddress && machine.ip_address !== detectedIpAddress
      ? await this.prisma.machine.update({
          where: { id: machine.id },
          data: { ip_address: detectedIpAddress }
        })
      : machine;

    const now = new Date();
    const previousSyncState = await this.prisma.machineSyncState.findUnique({
      where: { machine_id: currentMachine.id },
      select: {
        connection_status: true,
        last_seen_at: true
      }
    });
    const syncState = await this.prisma.machineSyncState.upsert({
      where: { machine_id: currentMachine.id },
      create: {
        machine_id: currentMachine.id,
        machine_code: currentMachine.machine_code,
        connection_status: "ONLINE",
        last_seen_at: now,
        last_ip_address: detectedIpAddress,
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
        last_ip_address: detectedIpAddress,
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
        machine_id: currentMachine.id,
        machine_code: currentMachine.machine_code,
        event_type: "HEARTBEAT",
        ip_address: detectedIpAddress,
        message: "Đã nhận nhịp kết nối từ máy cục bộ.",
        payload_json: JSON.parse(JSON.stringify({ ...dto, detected_ip_address: detectedIpAddress }))
      }
    });

    const runtimeSession = await this.ensureHeartbeatRuntimeSession(
      currentMachine,
      dto,
      detectedIpAddress,
      now,
      previousSyncState?.connection_status ?? null
    );

    return {
      success: true,
      code: "HEARTBEAT_ACCEPTED",
      message: "Đã nhận nhịp kết nối.",
      data: {
        machine: currentMachine,
        sync_state: syncState,
        runtime_session: runtimeSession
      }
    };
  }

  private async ensureHeartbeatRuntimeSession(
    machine: { id: number; machine_code: string },
    dto: HeartbeatDto,
    ipAddress: string | null,
    now: Date,
    previousConnectionStatus: string | null
  ) {
    const runningSession = await this.prisma.machineRuntimeSession.findFirst({
      where: {
        machine_id: machine.id,
        status: "RUNNING",
        ended_at: null
      },
      orderBy: [{ last_seen_at: "desc" }, { id: "desc" }],
      select: {
        id: true,
        current_product_id: true
      }
    });

    if (!runningSession) {
      await this.closeUnendedRuntimeSessionsForHeartbeat(machine.id, now);
      return this.createHeartbeatRuntimeSession(machine, dto, ipAddress, now, previousConnectionStatus);
    }

    await this.prisma.machineRuntimeSession.update({
      where: { id: runningSession.id },
      data: {
        status: "RUNNING",
        total_count: dto.local_total_record ?? undefined,
        ok_count: dto.local_ok_record ?? undefined,
        ng_count: dto.local_ng_record ?? undefined,
        disconnected_at: null,
        last_seen_at: now
      }
    });

    if (runningSession.current_product_id) {
      await this.prisma.machineRuntimeProduct.update({
        where: { id: runningSession.current_product_id },
        data: {
          total_count: dto.local_total_record ?? undefined,
          ok_count: dto.local_ok_record ?? undefined,
          ng_count: dto.local_ng_record ?? undefined
        }
      });
    }

    return this.prisma.machineRuntimeSession.findUnique({
      where: { id: runningSession.id },
      include: {
        current_product: true
      }
    });
  }

  private async createHeartbeatRuntimeSession(
    machine: { id: number; machine_code: string },
    dto: HeartbeatDto,
    ipAddress: string | null,
    now: Date,
    previousConnectionStatus: string | null
  ) {
    const session = await this.prisma.machineRuntimeSession.create({
      data: {
        session_code: this.buildRuntimeSessionCode(machine.machine_code),
        machine_id: machine.id,
        machine_code: machine.machine_code,
        status: "RUNNING",
        total_count: dto.local_total_record ?? 0,
        ok_count: dto.local_ok_record ?? 0,
        ng_count: dto.local_ng_record ?? 0,
        started_at: now,
        last_seen_at: now
      }
    });

    const product = await this.prisma.machineRuntimeProduct.create({
      data: {
        session_id: session.id,
        machine_id: machine.id,
        machine_code: machine.machine_code,
        product_code: "UNKNOWN",
        total_count: dto.local_total_record ?? 0,
        ok_count: dto.local_ok_record ?? 0,
        ng_count: dto.local_ng_record ?? 0,
        started_at: now
      }
    });

    await this.prisma.machineRuntimeSession.update({
      where: { id: session.id },
      data: {
        current_product_id: product.id
      }
    });

    await this.prisma.machineRuntimeEvent.create({
      data: {
        session_id: session.id,
        product_id: product.id,
        machine_id: machine.id,
        machine_code: machine.machine_code,
        event_type: "STARTED",
        product_code: "UNKNOWN",
        total_count: dto.local_total_record ?? null,
        ok_count: dto.local_ok_record ?? null,
        ng_count: dto.local_ng_record ?? null,
        ip_address: ipAddress,
        payload_json: JSON.parse(
          JSON.stringify({
            source: "HEARTBEAT",
            previous_connection_status: previousConnectionStatus,
            detected_ip_address: ipAddress,
            ...dto
          })
        )
      }
    });

    return this.prisma.machineRuntimeSession.findUnique({
      where: { id: session.id },
      include: {
        current_product: true
      }
    });
  }

  private async closeUnendedRuntimeSessionsForHeartbeat(machineId: number, now: Date) {
    const sessions = await this.prisma.machineRuntimeSession.findMany({
      where: {
        machine_id: machineId,
        ended_at: null,
        status: {
          in: ["DISCONNECTED", "ERROR"]
        }
      },
      select: {
        id: true
      }
    });

    if (sessions.length === 0) {
      return;
    }

    const sessionIds = sessions.map((session) => session.id);
    await this.prisma.machineRuntimeProduct.updateMany({
      where: {
        session_id: {
          in: sessionIds
        },
        ended_at: null
      },
      data: {
        ended_at: now
      }
    });
    await this.prisma.machineRuntimeSession.updateMany({
      where: {
        id: {
          in: sessionIds
        }
      },
      data: {
        ended_at: now,
        last_seen_at: now
      }
    });
  }

  private async ensureMachineById(id: number) {
    const machine = await this.prisma.machine.findUnique({
      where: { id }
    });

    if (!machine) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_NOT_FOUND",
        message: "Không tìm thấy máy."
      });
    }

    return machine;
  }

  async ensureActiveMachineIdentity(machineCode: string, identity: MachineIdentity) {
    const machine = await this.prisma.machine.findUnique({
      where: { machine_code: machineCode.trim() }
    });

    if (!machine || !machine.is_active) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_NOT_FOUND",
        message: "Mã máy không tồn tại hoặc đã bị tắt."
      });
    }

    const serial = this.requiredTrim(identity.serial, "serial");
    const uid = this.requiredTrim(identity.uid, "uid");
    if (!machine.serial || !machine.uid || machine.serial !== serial || machine.uid !== uid) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_IDENTITY_MISMATCH",
        message: "Mã máy, seri và UID không khớp định danh trên máy chủ."
      });
    }

    return machine;
  }

  async ensureActiveMachineSerialUid(identity: MachineIdentity) {
    return this.ensureActiveMachineByIdentity(identity);
  }

  private async ensureActiveMachineByIdentity(identity: MachineIdentity) {
    const serial = this.requiredTrim(identity.serial, "serial");
    const uid = this.requiredTrim(identity.uid, "uid");
    const machine = await this.prisma.machine.findFirst({
      where: {
        serial,
        uid
      }
    });

    if (machine?.is_active) {
      return machine;
    }

    if (machine) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_NOT_FOUND",
        message: "Không tìm thấy máy hoặc máy đã bị tắt."
      });
    }

    const partialMatches = await this.prisma.machine.findMany({
      where: {
        OR: [{ serial }, { uid }]
      },
      select: {
        machine_code: true,
        serial: true,
        uid: true,
        is_active: true
      }
    });

    if (partialMatches.length > 0) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_IDENTITY_MISMATCH",
        message: "Seri và UID không khớp với một định danh máy đã được duyệt.",
        data: {
          status: "MISMATCH",
          matches: partialMatches
        }
      });
    }

    throw new NotFoundException({
      success: false,
      code: "MACHINE_NOT_FOUND",
      message: "Không tìm thấy máy hoặc máy đã bị tắt."
    });
  }

  private async ensureRegistrationRequestById(id: number) {
    const request = await this.prisma.machineRegistrationRequest.findUnique({
      where: { id },
      include: {
        approved_machine: true
      }
    });

    if (!request) {
      throw new NotFoundException({
        success: false,
        code: "MACHINE_REGISTER_REQUEST_NOT_FOUND",
        message: "Không tìm thấy yêu cầu đăng ký máy."
      });
    }

    return request;
  }

  private async findIdentityDuplicates(input: {
    serial: string;
    uid: string;
    requestedMachineCode?: string | null;
    excludeRegistrationRequestId?: number;
  }) {
    const duplicates: IdentityDuplicate[] = [];
    const machineOr = [
      { serial: input.serial },
      { uid: input.uid },
      ...(input.requestedMachineCode ? [{ machine_code: input.requestedMachineCode }] : [])
    ];
    const machines = await this.prisma.machine.findMany({
      where: {
        OR: machineOr
      },
      select: {
        machine_code: true,
        serial: true,
        uid: true,
        ip_address: true
      }
    });

    for (const machine of machines) {
      if (machine.serial === input.serial) {
        duplicates.push({ field: "serial", value: input.serial, source: "machine", machine_code: machine.machine_code });
      }
      if (machine.uid === input.uid) {
        duplicates.push({ field: "uid", value: input.uid, source: "machine", machine_code: machine.machine_code });
      }
      if (input.requestedMachineCode && machine.machine_code === input.requestedMachineCode) {
        duplicates.push({ field: "machine_code", value: input.requestedMachineCode, source: "machine", machine_code: machine.machine_code });
      }
    }

    const registrationRequests = await this.prisma.machineRegistrationRequest.findMany({
      where: {
        id: input.excludeRegistrationRequestId ? { not: input.excludeRegistrationRequestId } : undefined,
        status: {
          in: ["PENDING", "APPROVED"]
        },
        OR: [
          { serial: input.serial },
          { uid: input.uid },
          ...(input.requestedMachineCode ? [{ requested_machine_code: input.requestedMachineCode }] : [])
        ]
      },
      select: {
        request_id: true,
        requested_machine_code: true,
        serial: true,
        uid: true,
        ip_address: true,
        status: true
      }
    });

    for (const request of registrationRequests) {
      if (request.serial === input.serial) {
        duplicates.push({ field: "serial", value: input.serial, source: "registration_request", request_id: request.request_id, status: request.status });
      }
      if (request.uid === input.uid) {
        duplicates.push({ field: "uid", value: input.uid, source: "registration_request", request_id: request.request_id, status: request.status });
      }
      if (input.requestedMachineCode && request.requested_machine_code === input.requestedMachineCode) {
        duplicates.push({
          field: "machine_code",
          value: input.requestedMachineCode,
          source: "registration_request",
          request_id: request.request_id,
          status: request.status
        });
      }
    }

    return duplicates;
  }

  private buildRegistrationRequestId() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `MREQ-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private buildRuntimeSessionCode(machineCode: string) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `RUN-${date}-${machineCode}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async resolveHeartbeatDisconnectSeconds() {
    const settings = await this.prisma.serverSetting.findFirst({
      orderBy: { id: "asc" },
      select: {
        heartbeat_timeout_seconds: true
      }
    });
    return Math.max(settings?.heartbeat_timeout_seconds ?? MIN_HEARTBEAT_DISCONNECT_SECONDS, MIN_HEARTBEAT_DISCONNECT_SECONDS);
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private buildMachineRegistrationDeleteWhere(machine: { id: number; machine_code: string; serial?: string | null; uid?: string | null }) {
    return {
      OR: [
        { approved_machine_id: machine.id },
        { approved_machine_code: machine.machine_code },
        { requested_machine_code: machine.machine_code },
        ...(machine.serial ? [{ serial: machine.serial }] : []),
        ...(machine.uid ? [{ uid: machine.uid }] : [])
      ]
    };
  }

  private readImportedLicense(dto: ImportMachineRegistrationLicenseDto) {
    const payload = this.readLicensePayload(dto);
    const payloadObject = this.asRecord(payload);
    const licenseKey =
      this.optionalTrim(dto.license_key) ??
      this.optionalTrim(this.readString(payloadObject, "license_key")) ??
      this.optionalTrim(this.readString(payloadObject, "raw_license_key")) ??
      this.optionalTrim(dto.license_file_text);

    if (!licenseKey && (payload === undefined || payload === null || payload === "")) {
      throw new BadRequestException({
        success: false,
        code: "MACHINE_LICENSE_INVALID",
        message: "Cần có nội dung tệp giấy phép."
      });
    }

    return {
      licenseKey: licenseKey ?? JSON.stringify(payload),
      payload:
        payload === undefined || payload === null
          ? {
              license_format: "SAMSUNG_QR_MACHINE_LICENSE_RAW_V1",
              license_key: licenseKey
            }
          : payload
    };
  }

  private readLicensePayload(dto: ImportMachineRegistrationLicenseDto) {
    if (dto.license_file !== undefined) {
      return dto.license_file;
    }

    const text = this.optionalTrim(dto.license_file_text);
    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private readString(record: Record<string, unknown>, key: string) {
    const value = record[key];
    return typeof value === "string" ? value : undefined;
  }

  private requiredTrim(value: string | null | undefined, fieldName: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      throw new BadRequestException({
        success: false,
        code: "PAYLOAD_INVALID",
        message: `Bắt buộc nhập ${fieldName}.`
      });
    }

    return trimmed;
  }

  private optionalTrim(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed || null;
  }
}
