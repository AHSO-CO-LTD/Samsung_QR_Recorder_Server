import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApiResponseDto<TData = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: "OK" })
  code!: string;

  @ApiProperty({ example: "Request completed successfully." })
  message!: string;

  @ApiPropertyOptional()
  data?: TData;
}
