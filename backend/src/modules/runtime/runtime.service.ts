import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MachinesService } from "../machines/machines.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RuntimeErrorDto, RuntimeHelloDto, RuntimeStartDto, RuntimeStopDto, RuntimeUpdateDto } from "./dto/runtime-ws.dto";

type RuntimeMachine = {
  id: number;
  machine_code: string;
  serial?: string | null;
  uid?: string | null;
};

type ProductIdentity = {
  profileId: number | null;
  productCode: string;
};

type RuntimeContext = {
  runtime_session_id: number;
  runtime_product_id: number | null;
};

@Injectable()
export class RuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly notifications: NotificationsService
  ) {}

  async acceptHello(dto: RuntimeHelloDto, socketIp?: string | null) {
    const machine = await this.machinesService.ensureActiveMachineIdentity(dto.machine_code, {
      serial: dto.serial,
      uid: dto.uid
    });
    const ipAddress = this.clean(socketIp) ?? this.clean(dto.ip_address) ?? null;
    const now = new Date();

    await this.upsertMachineSyncState(machine, {
      ipAddress,
      now,
      appVersion: this.clean(dto.app_version),
      localDbVersion: this.clean(dto.local_db_version)
    });

    await this.prisma.machineConnectionLog.create({
      data: {
        machine_id: machine.id,
        machine_code: machine.machine_code,
        event_type: "CONNECTED",
        ip_address: ipAddress,
        message: "WebSocket runtime connection accepted.",
        payload_json: this.toJson(dto)
      }
    });

    await this.writeRuntimeEvent({
      machine,
      eventType: "SOCKET_CONNECTED",
      ipAddress,
      payload: dto
    });

    return {
      success: true,
      code: "RUNTIME_SOCKET_ACCEPTED",
      message: "Machine runtime WebSocket accepted.",
      data: {
        machine,
        server_time: now.toISOString()
      }
    };
  }

  async markDisconnected(machine: RuntimeMachine, reason?: string, socketIp?: string | null) {
    const now = new Date();
    const session = await this.findOpenSession(machine.id);

    await (this.prisma as any).machineSyncState.upsert({
      where: { machine_id: machine.id },
      create: {
        machine_id: machine.id,
        machine_code: machine.machine_code,
        connection_status: "OFFLINE",
        last_seen_at: now,
        last_ip_address: socketIp ?? null
      },
      update: {
        connection_status: "OFFLINE",
        last_seen_at: now,
        last_ip_address: socketIp ?? undefined
      }
    });

    await this.prisma.machineConnectionLog.create({
      data: {
        machine_id: machine.id,
        machine_code: machine.machine_code,
        event_type: "DISCONNECTED",
        ip_address: socketIp ?? null,
        message: reason || "WebSocket runtime connection disconnected.",
        payload_json: this.toJson({ reason })
      }
    });

    await this.notifications.createEvent({
      notiCode: "MACHINE_RUNTIME_DISCONNECTED",
      machineId: machine.id,
      title: "Local machine disconnected",
      message: `Machine ${machine.machine_code} disconnected${socketIp ? ` from ${socketIp}` : ""}. ${reason || "WebSocket runtime connection disconnected."}`,
      severity: "WARNING",
      errorCode: "MACHINE_RUNTIME_DISCONNECTED"
    });

    if (session && session.status === "RUNNING") {
      const updatedSession = await (this.prisma as any).machineRuntimeSession.update({
        where: { id: session.id },
        data: {
          status: "DISCONNECTED",
          disconnected_at: now,
          last_seen_at: now
        },
        include: this.sessionInclude()
      });

      await this.writeRuntimeEvent({
        machine,
        sessionId: session.id,
        productId: session.current_product_id,
        eventType: "SOCKET_DISCONNECTED",
        ipAddress: socketIp ?? null,
        payload: { reason }
      });

      return updatedSession;
    }

    await this.writeRuntimeEvent({
      machine,
      sessionId: session?.id,
      productId: session?.current_product_id,
      eventType: "SOCKET_DISCONNECTED",
      ipAddress: socketIp ?? null,
      payload: { reason }
    });

    return session;
  }

  async start(machine: RuntimeMachine, dto: RuntimeStartDto, socketIp?: string | null) {
    const now = new Date();
    await this.closeOpenSessions(machine.id, now);
    return this.createSession(machine, dto, "STARTED", socketIp ?? null);
  }

  async update(machine: RuntimeMachine, dto: RuntimeUpdateDto, socketIp?: string | null, eventType: "UPDATED" | "SNAPSHOT" = "UPDATED") {
    const session = (await this.findOpenSession(machine.id)) ?? (await this.createSession(machine, dto, eventType, socketIp ?? null));
    const now = new Date();
    const product = await this.ensureCurrentProduct(session, machine, dto, now);
    const wasDisconnected = session.status === "DISCONNECTED";

    const updatedSession = await (this.prisma as any).machineRuntimeSession.update({
      where: { id: session.id },
      data: {
        status: "RUNNING",
        current_product_id: product?.id ?? null,
        total_count: dto.total_count ?? undefined,
        ok_count: dto.ok_count ?? undefined,
        ng_count: dto.ng_count ?? undefined,
        last_result: this.clean(dto.last_result) ?? undefined,
        last_code: this.clean(dto.last_code) ?? undefined,
        last_local_scan_id: this.clean(dto.local_scan_id) ?? undefined,
        disconnected_at: null,
        last_seen_at: now,
        reconnect_count: wasDisconnected ? { increment: 1 } : undefined
      },
      include: this.sessionInclude()
    });

    if (product) {
      await this.updateProductCounters(product.id, dto);
    }

    await this.upsertMachineSyncState(machine, {
      ipAddress: socketIp ?? null,
      now,
      localTotal: dto.total_count,
      localOk: dto.ok_count,
      localNg: dto.ng_count,
      pendingSync: dto.pending_sync
    });

    await this.writeRuntimeEvent({
      machine,
      sessionId: updatedSession.id,
      productId: product?.id,
      profileId: product?.profile_id,
      eventType,
      ipAddress: socketIp ?? null,
      payload: dto,
      counts: dto
    });

    return this.getSessionEntity(updatedSession.id);
  }

  async stop(machine: RuntimeMachine, dto: RuntimeStopDto, socketIp?: string | null) {
    const session = await this.findOpenSession(machine.id);
    if (!session) {
      throw new BadRequestException({
        success: false,
        code: "RUNTIME_SESSION_NOT_FOUND",
        message: "No open runtime session was found for this machine."
      });
    }

    const now = dto.stopped_at ? new Date(dto.stopped_at) : new Date();
    await this.updateProductCounters(session.current_product_id, dto, now);

    const updatedSession = await (this.prisma as any).machineRuntimeSession.update({
      where: { id: session.id },
      data: {
        status: "STOPPED",
        total_count: dto.total_count ?? undefined,
        ok_count: dto.ok_count ?? undefined,
        ng_count: dto.ng_count ?? undefined,
        last_result: this.clean(dto.last_result) ?? undefined,
        last_code: this.clean(dto.last_code) ?? undefined,
        last_local_scan_id: this.clean(dto.local_scan_id) ?? undefined,
        ended_at: now,
        disconnected_at: null,
        last_seen_at: now
      },
      include: this.sessionInclude()
    });

    await this.writeRuntimeEvent({
      machine,
      sessionId: session.id,
      productId: session.current_product_id,
      eventType: "STOPPED",
      ipAddress: socketIp ?? null,
      payload: dto,
      counts: dto
    });

    return updatedSession;
  }

  async recordError(machine: RuntimeMachine, dto: RuntimeErrorDto, socketIp?: string | null) {
    const session = (await this.findOpenSession(machine.id)) ?? (await this.createSession(machine, dto, "ERROR", socketIp ?? null));
    const now = new Date();
    const product = await this.ensureCurrentProduct(session, machine, dto, now);
    const updatedSession = await (this.prisma as any).machineRuntimeSession.update({
      where: { id: session.id },
      data: {
        status: "ERROR",
        current_product_id: product?.id ?? null,
        total_count: dto.total_count ?? undefined,
        ok_count: dto.ok_count ?? undefined,
        ng_count: dto.ng_count ?? undefined,
        last_result: this.clean(dto.last_result) ?? "ERROR",
        last_code: this.clean(dto.last_code) ?? undefined,
        last_local_scan_id: this.clean(dto.local_scan_id) ?? undefined,
        last_seen_at: now
      },
      include: this.sessionInclude()
    });

    await this.writeRuntimeEvent({
      machine,
      sessionId: session.id,
      productId: product?.id,
      profileId: product?.profile_id,
      eventType: "ERROR",
      ipAddress: socketIp ?? null,
      payload: dto,
      counts: dto
    });

    return updatedSession;
  }

  async listSessions(query: { take: number; machine_code?: string; status?: string }) {
    const sessions = await (this.prisma as any).machineRuntimeSession.findMany({
      where: {
        machine_code: this.clean(query.machine_code) ?? undefined,
        status: this.clean(query.status) ?? undefined
      },
      take: Math.min(Math.max(query.take || 50, 1), 200),
      orderBy: [{ last_seen_at: "desc" }, { id: "desc" }],
      include: this.sessionInclude()
    });

    return {
      success: true,
      code: "RUNTIME_SESSIONS_LISTED",
      message: "Machine runtime sessions loaded.",
      data: sessions
    };
  }

  async getSession(id: number) {
    const session = await this.getSessionEntity(id);
    if (!session) {
      throw new BadRequestException({
        success: false,
        code: "RUNTIME_SESSION_NOT_FOUND",
        message: "Runtime session was not found."
      });
    }

    return {
      success: true,
      code: "RUNTIME_SESSION_LOADED",
      message: "Machine runtime session loaded.",
      data: session
    };
  }

  async resolveRuntimeForScan(machineId: number, profileId: number): Promise<RuntimeContext | null> {
    const session = await this.findOpenSession(machineId);
    if (!session) {
      return null;
    }

    const machine = {
      id: session.machine_id,
      machine_code: session.machine_code
    };
    const product = await this.ensureCurrentProduct(session, machine, { profile_id: profileId }, new Date());

    await this.writeRuntimeEvent({
      machine,
      sessionId: session.id,
      productId: product?.id,
      profileId,
      eventType: "SCAN_LINKED",
      payload: { profile_id: profileId }
    });

    return {
      runtime_session_id: session.id,
      runtime_product_id: product?.id ?? null
    };
  }

  private async createSession(machine: RuntimeMachine, dto: RuntimeStartDto | RuntimeUpdateDto | RuntimeErrorDto, eventType: "STARTED" | "SNAPSHOT" | "UPDATED" | "ERROR", socketIp?: string | null) {
    const now = "started_at" in dto && dto.started_at ? new Date(dto.started_at) : new Date();
    const identity = await this.resolveProductIdentity(dto);
    const session = await (this.prisma as any).machineRuntimeSession.create({
      data: {
        session_code: this.buildSessionCode(machine.machine_code),
        machine_id: machine.id,
        machine_code: machine.machine_code,
        status: eventType === "ERROR" ? "ERROR" : "RUNNING",
        total_count: dto.total_count ?? 0,
        ok_count: dto.ok_count ?? 0,
        ng_count: dto.ng_count ?? 0,
        started_at: now,
        last_seen_at: now
      }
    });

    const product = await (this.prisma as any).machineRuntimeProduct.create({
      data: {
        session_id: session.id,
        machine_id: machine.id,
        machine_code: machine.machine_code,
        profile_id: identity.profileId,
        product_code: identity.productCode,
        total_count: dto.product_total_count ?? dto.total_count ?? 0,
        ok_count: dto.product_ok_count ?? dto.ok_count ?? 0,
        ng_count: dto.product_ng_count ?? dto.ng_count ?? 0,
        started_at: now
      }
    });

    await (this.prisma as any).machineRuntimeSession.update({
      where: { id: session.id },
      data: {
        current_product_id: product.id
      }
    });

    await this.writeRuntimeEvent({
      machine,
      sessionId: session.id,
      productId: product.id,
      profileId: identity.profileId,
      eventType,
      productCode: identity.productCode,
      ipAddress: socketIp ?? null,
      payload: dto,
      counts: dto
    });

    return this.getSessionEntity(session.id);
  }

  private async ensureCurrentProduct(session: any, machine: RuntimeMachine, dto: RuntimeUpdateDto | RuntimeStartDto | RuntimeErrorDto, now: Date) {
    const identity = await this.resolveProductIdentity(dto, session.current_product);
    const currentProduct = session.current_product;
    if (currentProduct && this.isSameProduct(currentProduct, identity)) {
      return currentProduct;
    }

    if (currentProduct && !currentProduct.ended_at) {
      await (this.prisma as any).machineRuntimeProduct.update({
        where: { id: currentProduct.id },
        data: { ended_at: now }
      });
    }

    const product = await (this.prisma as any).machineRuntimeProduct.create({
      data: {
        session_id: session.id,
        machine_id: machine.id,
        machine_code: machine.machine_code,
        profile_id: identity.profileId,
        product_code: identity.productCode,
        total_count: dto.product_total_count ?? 0,
        ok_count: dto.product_ok_count ?? 0,
        ng_count: dto.product_ng_count ?? 0,
        last_result: "last_result" in dto ? this.clean(dto.last_result) : null,
        last_code: "last_code" in dto ? this.clean(dto.last_code) : null,
        last_local_scan_id: "local_scan_id" in dto ? this.clean(dto.local_scan_id) : null,
        started_at: now
      }
    });

    await (this.prisma as any).machineRuntimeSession.update({
      where: { id: session.id },
      data: { current_product_id: product.id }
    });

    await this.writeRuntimeEvent({
      machine,
      sessionId: session.id,
      productId: product.id,
      profileId: identity.profileId,
      eventType: "PRODUCT_CHANGED",
      productCode: identity.productCode,
      payload: dto
    });

    return product;
  }

  private async updateProductCounters(productId: number | null | undefined, dto: RuntimeUpdateDto | RuntimeStopDto, endedAt?: Date) {
    if (!productId) {
      return null;
    }

    return (this.prisma as any).machineRuntimeProduct.update({
      where: { id: productId },
      data: {
        total_count: dto.product_total_count ?? undefined,
        ok_count: dto.product_ok_count ?? undefined,
        ng_count: dto.product_ng_count ?? undefined,
        last_result: this.clean(dto.last_result) ?? undefined,
        last_code: this.clean(dto.last_code) ?? undefined,
        last_local_scan_id: this.clean(dto.local_scan_id) ?? undefined,
        ended_at: endedAt ?? undefined
      }
    });
  }

  private async closeOpenSessions(machineId: number, now: Date) {
    const openSessions = await (this.prisma as any).machineRuntimeSession.findMany({
      where: {
        machine_id: machineId,
        status: {
          in: ["RUNNING", "DISCONNECTED", "ERROR"]
        },
        ended_at: null
      },
      select: {
        id: true
      }
    });

    if (openSessions.length === 0) {
      return;
    }

    const sessionIds = openSessions.map((session: { id: number }) => session.id);
    await (this.prisma as any).machineRuntimeProduct.updateMany({
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
    await (this.prisma as any).machineRuntimeSession.updateMany({
      where: {
        id: {
          in: sessionIds
        }
      },
      data: {
        status: "STOPPED",
        ended_at: now,
        last_seen_at: now
      }
    });
  }

  private async findOpenSession(machineId: number) {
    return (this.prisma as any).machineRuntimeSession.findFirst({
      where: {
        machine_id: machineId,
        status: {
          in: ["RUNNING", "DISCONNECTED", "ERROR"]
        },
        ended_at: null
      },
      orderBy: [{ last_seen_at: "desc" }, { id: "desc" }],
      include: {
        current_product: true
      }
    });
  }

  private async getSessionEntity(id: number) {
    return (this.prisma as any).machineRuntimeSession.findUnique({
      where: { id },
      include: {
        ...this.sessionInclude(),
        events: {
          take: 300,
          orderBy: { created_at: "desc" }
        },
        scan_records: {
          take: 300,
          orderBy: { scan_at: "desc" },
          include: {
            profile: {
              include: {
                chassis_code: true
              }
            }
          }
        },
        adjustments: {
          orderBy: { created_at: "desc" },
          include: {
            adjustedBy: {
              select: {
                id: true,
                username: true,
                full_name: true,
                role: true
              }
            }
          }
        }
      }
    });
  }

  private sessionInclude() {
    return {
      machine: true,
      current_product: true,
      products: {
        orderBy: { started_at: "asc" },
        include: {
          profile: {
            include: {
              chassis_code: true
            }
          }
        }
      }
    };
  }

  private async resolveProductIdentity(dto: { profile_id?: number; product_code?: string }, fallback?: { profile_id?: number | null; product_code?: string | null }): Promise<ProductIdentity> {
    const profileId = dto.profile_id ?? fallback?.profile_id ?? null;
    const productCode = this.clean(dto.product_code) ?? this.clean(fallback?.product_code);
    if (productCode) {
      return {
        profileId,
        productCode
      };
    }

    if (profileId) {
      const profile = await this.prisma.productProfile.findUnique({
        where: { id: profileId },
        include: {
          chassis_code: true
        }
      });

      return {
        profileId,
        productCode: profile?.chassis_code?.code_full ?? `PROFILE-${profileId}`
      };
    }

    return {
      profileId: null,
      productCode: "UNKNOWN"
    };
  }

  private isSameProduct(product: { profile_id?: number | null; product_code?: string | null }, identity: ProductIdentity) {
    const currentProductCode = this.clean(product.product_code);
    if (identity.productCode && currentProductCode && identity.productCode !== currentProductCode) {
      return false;
    }

    if (identity.profileId && product.profile_id && identity.profileId === product.profile_id) {
      return true;
    }

    return currentProductCode === identity.productCode;
  }

  private async upsertMachineSyncState(
    machine: RuntimeMachine,
    input: {
      ipAddress?: string | null;
      now: Date;
      localTotal?: number;
      localOk?: number;
      localNg?: number;
      pendingSync?: number;
      appVersion?: string | null;
      localDbVersion?: string | null;
    }
  ) {
    if (input.ipAddress) {
      await (this.prisma as any).machine.update({
        where: { id: machine.id },
        data: { ip_address: input.ipAddress }
      });
    }

    return (this.prisma as any).machineSyncState.upsert({
      where: { machine_id: machine.id },
      create: {
        machine_id: machine.id,
        machine_code: machine.machine_code,
        connection_status: "ONLINE",
        last_seen_at: input.now,
        last_ip_address: input.ipAddress ?? null,
        local_total_record: input.localTotal ?? 0,
        local_ok_record: input.localOk ?? 0,
        local_ng_record: input.localNg ?? 0,
        local_pending_sync: input.pendingSync ?? 0,
        app_version: input.appVersion ?? null,
        local_db_version: input.localDbVersion ?? null
      },
      update: {
        connection_status: "ONLINE",
        last_seen_at: input.now,
        last_ip_address: input.ipAddress ?? undefined,
        local_total_record: input.localTotal ?? undefined,
        local_ok_record: input.localOk ?? undefined,
        local_ng_record: input.localNg ?? undefined,
        local_pending_sync: input.pendingSync ?? undefined,
        app_version: input.appVersion ?? undefined,
        local_db_version: input.localDbVersion ?? undefined
      }
    });
  }

  private async writeRuntimeEvent(input: {
    machine: RuntimeMachine;
    sessionId?: number | null;
    productId?: number | null;
    profileId?: number | null;
    eventType: string;
    productCode?: string | null;
    ipAddress?: string | null;
    payload?: unknown;
    counts?: {
      total_count?: number;
      ok_count?: number;
      ng_count?: number;
      last_result?: string;
      last_code?: string;
      local_scan_id?: string;
    };
  }) {
    return (this.prisma as any).machineRuntimeEvent.create({
      data: {
        session_id: input.sessionId ?? null,
        product_id: input.productId ?? null,
        machine_id: input.machine.id,
        machine_code: input.machine.machine_code,
        profile_id: input.profileId ?? null,
        event_type: input.eventType,
        product_code: input.productCode ?? null,
        total_count: input.counts?.total_count ?? null,
        ok_count: input.counts?.ok_count ?? null,
        ng_count: input.counts?.ng_count ?? null,
        last_result: this.clean(input.counts?.last_result) ?? null,
        last_code: this.clean(input.counts?.last_code) ?? null,
        local_scan_id: this.clean(input.counts?.local_scan_id) ?? null,
        ip_address: input.ipAddress ?? null,
        payload_json: this.toJson(input.payload ?? {})
      }
    });
  }

  private buildSessionCode(machineCode: string) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `RUN-${date}-${machineCode}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private clean(value: string | null | undefined) {
    const trimmed = value?.trim();
    return trimmed || null;
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value ?? {}));
  }
}
