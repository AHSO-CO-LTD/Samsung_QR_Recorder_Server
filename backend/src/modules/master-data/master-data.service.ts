import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateChassisCodeDto,
  CreateLedCodeDto,
  CreateVendorDto,
  UpdateChassisCodeDto,
  UpdateLedCodeDto,
  UpdateVendorDto
} from "./dto/master-data.dto";

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listVendors() {
    const vendors = await this.prisma.vendor.findMany({
      orderBy: [{ status: "asc" }, { vendor_char: "asc" }]
    });

    return {
      success: true,
      code: "VENDORS_LISTED",
      message: "Vendors loaded.",
      data: vendors
    };
  }

  async createVendor(dto: CreateVendorDto, actorUserId?: number | null) {
    const vendor = await this.prisma.vendor.create({
      data: {
        vendor_name: dto.vendor_name.trim(),
        vendor_char: dto.vendor_char.trim(),
        status: dto.status ?? "ACTIVE"
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_VENDOR",
      tableName: "vendors",
      recordId: vendor.id,
      newValue: vendor
    });

    return {
      success: true,
      code: "VENDOR_CREATED",
      message: "Vendor created.",
      data: vendor
    };
  }

  async updateVendor(id: number, dto: UpdateVendorDto, actorUserId?: number | null) {
    const oldVendor = await this.ensureVendor(id);
    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: {
        vendor_name: dto.vendor_name?.trim(),
        vendor_char: dto.vendor_char?.trim(),
        status: dto.status
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_VENDOR",
      tableName: "vendors",
      recordId: vendor.id,
      oldValue: oldVendor,
      newValue: vendor
    });

    return {
      success: true,
      code: "VENDOR_UPDATED",
      message: "Vendor updated.",
      data: vendor
    };
  }

  async disableVendor(id: number, actorUserId?: number | null) {
    const oldVendor = await this.ensureVendor(id);
    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: { status: "DISABLED" }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "DISABLE_VENDOR",
      tableName: "vendors",
      recordId: vendor.id,
      oldValue: oldVendor,
      newValue: vendor
    });

    return {
      success: true,
      code: "VENDOR_DISABLED",
      message: "Vendor disabled.",
      data: vendor
    };
  }

  async listChassisCodes() {
    const chassisCodes = await this.prisma.chassisCode.findMany({
      orderBy: [{ is_active: "desc" }, { code_full: "asc" }],
      include: {
        product_profile: true
      }
    });

    return {
      success: true,
      code: "CHASSIS_CODES_LISTED",
      message: "Chassis codes loaded.",
      data: chassisCodes
    };
  }

  async createChassisCode(dto: CreateChassisCodeDto, actorUserId?: number | null) {
    const chassisCode = await this.prisma.chassisCode.create({
      data: {
        code_full: dto.code_full.trim(),
        code_input: dto.code_input.trim(),
        is_active: dto.is_active ?? true
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_CHASSIS_CODE",
      tableName: "chassis_codes",
      recordId: chassisCode.id,
      newValue: chassisCode
    });

    return {
      success: true,
      code: "CHASSIS_CODE_CREATED",
      message: "Chassis code created.",
      data: chassisCode
    };
  }

  async updateChassisCode(id: number, dto: UpdateChassisCodeDto, actorUserId?: number | null) {
    const oldChassisCode = await this.ensureChassisCode(id);
    const chassisCode = await this.prisma.chassisCode.update({
      where: { id },
      data: {
        code_full: dto.code_full?.trim(),
        code_input: dto.code_input?.trim(),
        is_active: dto.is_active
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_CHASSIS_CODE",
      tableName: "chassis_codes",
      recordId: chassisCode.id,
      oldValue: oldChassisCode,
      newValue: chassisCode
    });

    return {
      success: true,
      code: "CHASSIS_CODE_UPDATED",
      message: "Chassis code updated.",
      data: chassisCode
    };
  }

  async deactivateChassisCode(id: number, actorUserId?: number | null) {
    const oldChassisCode = await this.ensureChassisCode(id);
    const chassisCode = await this.prisma.chassisCode.update({
      where: { id },
      data: { is_active: false }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "DEACTIVATE_CHASSIS_CODE",
      tableName: "chassis_codes",
      recordId: chassisCode.id,
      oldValue: oldChassisCode,
      newValue: chassisCode
    });

    return {
      success: true,
      code: "CHASSIS_CODE_DEACTIVATED",
      message: "Chassis code deactivated.",
      data: chassisCode
    };
  }

  async listLedCodes() {
    const ledCodes = await this.prisma.ledCode.findMany({
      orderBy: [{ is_active: "desc" }, { code_full: "asc" }]
    });

    return {
      success: true,
      code: "LED_CODES_LISTED",
      message: "LED codes loaded.",
      data: ledCodes
    };
  }

  async createLedCode(dto: CreateLedCodeDto, actorUserId?: number | null) {
    const ledCode = await this.prisma.ledCode.create({
      data: {
        code_full: dto.code_full.trim(),
        code_input: dto.code_input.trim(),
        suffix_check: dto.suffix_check.trim(),
        is_active: dto.is_active ?? true
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_LED_CODE",
      tableName: "led_codes",
      recordId: ledCode.id,
      newValue: ledCode
    });

    return {
      success: true,
      code: "LED_CODE_CREATED",
      message: "LED code created.",
      data: ledCode
    };
  }

  async updateLedCode(id: number, dto: UpdateLedCodeDto, actorUserId?: number | null) {
    const oldLedCode = await this.ensureLedCode(id);
    const ledCode = await this.prisma.ledCode.update({
      where: { id },
      data: {
        code_full: dto.code_full?.trim(),
        code_input: dto.code_input?.trim(),
        suffix_check: dto.suffix_check?.trim(),
        is_active: dto.is_active
      }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_LED_CODE",
      tableName: "led_codes",
      recordId: ledCode.id,
      oldValue: oldLedCode,
      newValue: ledCode
    });

    return {
      success: true,
      code: "LED_CODE_UPDATED",
      message: "LED code updated.",
      data: ledCode
    };
  }

  async deactivateLedCode(id: number, actorUserId?: number | null) {
    const oldLedCode = await this.ensureLedCode(id);
    const ledCode = await this.prisma.ledCode.update({
      where: { id },
      data: { is_active: false }
    });
    await this.audit.write({
      userId: actorUserId,
      action: "DEACTIVATE_LED_CODE",
      tableName: "led_codes",
      recordId: ledCode.id,
      oldValue: oldLedCode,
      newValue: ledCode
    });

    return {
      success: true,
      code: "LED_CODE_DEACTIVATED",
      message: "LED code deactivated.",
      data: ledCode
    };
  }

  private async ensureVendor(id: number) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      throw new NotFoundException({
        success: false,
        code: "VENDOR_NOT_FOUND",
        message: "Vendor was not found."
      });
    }

    return vendor;
  }

  private async ensureChassisCode(id: number) {
    const chassisCode = await this.prisma.chassisCode.findUnique({ where: { id } });
    if (!chassisCode) {
      throw new NotFoundException({
        success: false,
        code: "CHASSIS_CODE_NOT_FOUND",
        message: "Chassis code was not found."
      });
    }

    return chassisCode;
  }

  private async ensureLedCode(id: number) {
    const ledCode = await this.prisma.ledCode.findUnique({ where: { id } });
    if (!ledCode) {
      throw new NotFoundException({
        success: false,
        code: "LED_CODE_NOT_FOUND",
        message: "LED code was not found."
      });
    }

    return ledCode;
  }
}
