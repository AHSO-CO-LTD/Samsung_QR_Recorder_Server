import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateProfileDto, ProfileLedCodeInputDto, UpdateProfileDto } from "./dto/profile-crud.dto";

const MAX_PROFILE_LED_CODES = 2;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async listProfiles() {
    const profiles = await this.prisma.productProfile.findMany({
      orderBy: [{ is_active: "desc" }, { updated_at: "desc" }],
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
    });

    return {
      success: true,
      code: "PROFILES_LISTED",
      message: "Product profiles loaded.",
      data: profiles
    };
  }

  async getProfile(id: number) {
    const profile = await this.findProfileById(id);

    return {
      success: true,
      code: "PROFILE_LOADED",
      message: "Product profile loaded.",
      data: profile
    };
  }

  async createProfile(dto: CreateProfileDto, actorUserId?: number | null) {
    const profile = await this.prisma.$transaction(async (tx) => {
      await this.ensureLedCodes(tx, dto.led_codes);
      await this.ensureChassisCode(tx, dto.chassis_code_id);

      const createdProfile = await tx.productProfile.create({
        data: {
          chassis_code_id: dto.chassis_code_id,
          factory_code: dto.factory_code.trim(),
          full_code_length: dto.full_code_length ?? 35,
          full_vendor_position: dto.full_vendor_position ?? 18,
          led_scan_length: dto.led_scan_length ?? 22,
          led_vendor_position: dto.led_vendor_position ?? 16,
          version: 1,
          is_active: true,
          created_by: dto.created_by ?? null,
          profile_led_codes: {
            create: dto.led_codes.map((item) => ({
              led_code_id: item.led_code_id,
              led_slot: item.led_slot,
              is_required: item.is_required ?? true
            }))
          }
        }
      });

      const loadedProfile = await this.findProfileByIdInTransaction(tx, createdProfile.id);
      await this.createProfileSnapshot(tx, loadedProfile, dto.created_by ?? actorUserId ?? null);
      return loadedProfile;
    });
    await this.audit.write({
      userId: actorUserId,
      action: "CREATE_PROFILE",
      tableName: "product_profiles",
      recordId: profile.id,
      newValue: profile
    });

    return {
      success: true,
      code: "PROFILE_CREATED",
      message: "Product profile created.",
      data: profile
    };
  }

  async updateProfile(id: number, dto: UpdateProfileDto, actorUserId?: number | null) {
    const oldProfile = await this.findProfileById(id);
    const profile = await this.prisma.$transaction(async (tx) => {
      await this.ensureProfileById(tx, id);
      if (dto.led_codes) {
        await this.ensureLedCodes(tx, dto.led_codes);
      }

      const shouldVersion =
        dto.factory_code !== undefined ||
        dto.full_code_length !== undefined ||
        dto.full_vendor_position !== undefined ||
        dto.led_scan_length !== undefined ||
        dto.led_vendor_position !== undefined ||
        dto.led_codes !== undefined;

      const updatedProfile = await tx.productProfile.update({
        where: { id },
        data: {
          factory_code: dto.factory_code?.trim(),
          full_code_length: dto.full_code_length,
          full_vendor_position: dto.full_vendor_position,
          led_scan_length: dto.led_scan_length,
          led_vendor_position: dto.led_vendor_position,
          is_active: dto.is_active,
          version: shouldVersion ? { increment: 1 } : undefined
        }
      });

      if (dto.led_codes) {
        await tx.profileLedCode.deleteMany({
          where: { profile_id: id }
        });
        await tx.profileLedCode.createMany({
          data: dto.led_codes.map((item) => ({
            profile_id: id,
            led_code_id: item.led_code_id,
            led_slot: item.led_slot,
            is_required: item.is_required ?? true
          }))
        });
      }

      const loadedProfile = await this.findProfileByIdInTransaction(tx, updatedProfile.id);
      if (shouldVersion) {
        await this.createProfileSnapshot(tx, loadedProfile, dto.updated_by ?? actorUserId ?? null);
      }
      return loadedProfile;
    });
    await this.audit.write({
      userId: actorUserId,
      action: "UPDATE_PROFILE",
      tableName: "product_profiles",
      recordId: profile.id,
      oldValue: oldProfile,
      newValue: profile
    });

    return {
      success: true,
      code: "PROFILE_UPDATED",
      message: "Product profile updated.",
      data: profile
    };
  }

  async deactivateProfile(id: number, actorUserId?: number | null) {
    const oldProfile = await this.findProfileById(id);
    const profile = await this.prisma.productProfile.update({
      where: { id },
      data: { is_active: false },
      include: this.profileInclude()
    });
    await this.audit.write({
      userId: actorUserId,
      action: "DEACTIVATE_PROFILE",
      tableName: "product_profiles",
      recordId: profile.id,
      oldValue: oldProfile,
      newValue: profile
    });

    return {
      success: true,
      code: "PROFILE_DEACTIVATED",
      message: "Product profile deactivated.",
      data: profile
    };
  }

  private async findProfileById(id: number) {
    const profile = await this.prisma.productProfile.findUnique({
      where: { id },
      include: this.profileInclude()
    });

    if (!profile) {
      throw new NotFoundException({
        success: false,
        code: "PROFILE_NOT_FOUND",
        message: "Product profile was not found."
      });
    }

    return profile;
  }

  private async findProfileByIdInTransaction(tx: Prisma.TransactionClient, id: number) {
    return tx.productProfile.findUniqueOrThrow({
      where: { id },
      include: this.profileInclude()
    });
  }

  private profileInclude() {
    return {
      chassis_code: true,
      profile_led_codes: {
        include: {
          led_code: true
        },
        orderBy: {
          led_slot: "asc" as const
        }
      }
    };
  }

  private async ensureProfileById(tx: Prisma.TransactionClient, id: number) {
    const profile = await tx.productProfile.findUnique({ where: { id } });
    if (!profile) {
      throw new NotFoundException({
        success: false,
        code: "PROFILE_NOT_FOUND",
        message: "Product profile was not found."
      });
    }
  }

  private async ensureChassisCode(tx: Prisma.TransactionClient, id: number) {
    const chassisCode = await tx.chassisCode.findUnique({ where: { id } });
    if (!chassisCode || !chassisCode.is_active) {
      throw new NotFoundException({
        success: false,
        code: "CHASSIS_CODE_NOT_FOUND",
        message: "Active chassis code was not found."
      });
    }
  }

  private async ensureLedCodes(tx: Prisma.TransactionClient, ledCodes: ProfileLedCodeInputDto[]) {
    if (ledCodes.length > MAX_PROFILE_LED_CODES) {
      throw new BadRequestException({
        success: false,
        code: "PROFILE_LED_CODES_LIMIT_EXCEEDED",
        message: `A product profile can use at most ${MAX_PROFILE_LED_CODES} LED codes.`
      });
    }

    for (const item of ledCodes) {
      const ledCode = await tx.ledCode.findUnique({ where: { id: item.led_code_id } });
      if (!ledCode || !ledCode.is_active) {
        throw new NotFoundException({
          success: false,
          code: "LED_CODE_NOT_FOUND",
          message: `Active LED code was not found: ${item.led_code_id}.`
        });
      }
    }
  }

  private createProfileSnapshot(
    tx: Prisma.TransactionClient,
    profile: Awaited<ReturnType<ProfilesService["findProfileByIdInTransaction"]>>,
    createdBy: number | null
  ) {
    return tx.profileSnapshot.create({
      data: {
        profile_id: profile.id,
        version: profile.version,
        created_by: createdBy,
        snapshot_json: JSON.parse(
          JSON.stringify({
            id: profile.id,
            version: profile.version,
            chassis_code: profile.chassis_code,
            factory_code: profile.factory_code,
            full_code_length: profile.full_code_length,
            full_vendor_position: profile.full_vendor_position,
            led_scan_length: profile.led_scan_length,
            led_vendor_position: profile.led_vendor_position,
            led_codes: profile.profile_led_codes
          })
        )
      }
    });
  }
}
