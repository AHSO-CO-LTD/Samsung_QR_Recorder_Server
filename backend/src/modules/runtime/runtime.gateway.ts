import { Logger, UsePipes, ValidationPipe } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { getClientIp } from "../../common/http/client-ip";
import { RuntimeErrorDto, RuntimeHelloDto, RuntimeStartDto, RuntimeStopDto, RuntimeUpdateDto } from "./dto/runtime-ws.dto";
import { RuntimeService } from "./runtime.service";

type RuntimeSocketData = {
  machine?: {
    id: number;
    machine_code: string;
    serial?: string | null;
    uid?: string | null;
  };
};

@WebSocketGateway({
  namespace: "/machine-runtime",
  cors: {
    origin: "*"
  },
  transports: ["websocket", "polling"]
})
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true
  })
)
export class RuntimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RuntimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly runtimeService: RuntimeService) {}

  publishScanUpdated(payload: { machine_code: string; local_scan_id: string; result_code: string }) {
    this.server?.emit("server:scan-updated", payload);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Runtime socket connected: ${client.id}`);
    client.emit("server:hello-required", {
      code: "RUNTIME_HELLO_REQUIRED",
      message: "Hãy gửi machine:hello kèm machine_code, serial và uid trước các sự kiện phiên chạy."
    });
  }

  async handleDisconnect(client: Socket) {
    const machine = this.getSocketData(client).machine;
    this.logger.log(`Runtime socket disconnected: ${client.id}`);
    if (!machine) {
      return;
    }

    const session = await this.runtimeService.markDisconnected(machine, "Socket đã ngắt kết nối.", this.getClientIp(client));
    this.server.emit("server:runtime-updated", {
      event: "SOCKET_DISCONNECTED",
      machine_code: machine.machine_code,
      data: session
    });
  }

  @SubscribeMessage("machine:hello")
  async handleHello(@MessageBody() dto: RuntimeHelloDto, @ConnectedSocket() client: Socket) {
    const response = await this.runtimeService.acceptHello(dto, this.getClientIp(client));
    this.getSocketData(client).machine = response.data.machine;
    client.emit("machine:accepted", response);
    this.server.emit("server:runtime-updated", {
      event: "SOCKET_CONNECTED",
      machine_code: response.data.machine.machine_code,
      data: response.data
    });
    return response;
  }

  @SubscribeMessage("runtime:start")
  async handleStart(@MessageBody() dto: RuntimeStartDto, @ConnectedSocket() client: Socket) {
    const machine = this.requireMachine(client);
    const session = await this.runtimeService.start(machine, dto, this.getClientIp(client));
    const response = this.ok("RUNTIME_SESSION_STARTED", "Đã bắt đầu phiên chạy.", session);
    this.server.emit("server:runtime-updated", {
      event: "STARTED",
      machine_code: machine.machine_code,
      data: session
    });
    return response;
  }

  @SubscribeMessage("runtime:update")
  async handleUpdate(@MessageBody() dto: RuntimeUpdateDto, @ConnectedSocket() client: Socket) {
    const machine = this.requireMachine(client);
    const session = await this.runtimeService.update(machine, dto, this.getClientIp(client), "UPDATED");
    const response = this.ok("RUNTIME_SESSION_UPDATED", "Đã cập nhật phiên chạy.", session);
    this.server.emit("server:runtime-updated", {
      event: "UPDATED",
      machine_code: machine.machine_code,
      data: session
    });
    return response;
  }

  @SubscribeMessage("runtime:snapshot")
  async handleSnapshot(@MessageBody() dto: RuntimeUpdateDto, @ConnectedSocket() client: Socket) {
    const machine = this.requireMachine(client);
    const session = await this.runtimeService.update(machine, dto, this.getClientIp(client), "SNAPSHOT");
    const response = this.ok("RUNTIME_SESSION_SNAPSHOT_SAVED", "Đã lưu ảnh chụp phiên chạy.", session);
    this.server.emit("server:runtime-updated", {
      event: "SNAPSHOT",
      machine_code: machine.machine_code,
      data: session
    });
    return response;
  }

  @SubscribeMessage("runtime:stop")
  async handleStop(@MessageBody() dto: RuntimeStopDto, @ConnectedSocket() client: Socket) {
    const machine = this.requireMachine(client);
    const session = await this.runtimeService.stop(machine, dto, this.getClientIp(client));
    const response = this.ok("RUNTIME_SESSION_STOPPED", "Đã dừng phiên chạy.", session);
    this.server.emit("server:runtime-updated", {
      event: "STOPPED",
      machine_code: machine.machine_code,
      data: session
    });
    return response;
  }

  @SubscribeMessage("runtime:error")
  async handleError(@MessageBody() dto: RuntimeErrorDto, @ConnectedSocket() client: Socket) {
    const machine = this.requireMachine(client);
    const session = await this.runtimeService.recordError(machine, dto, this.getClientIp(client));
    const response = this.ok("RUNTIME_SESSION_ERROR_RECORDED", "Đã ghi nhận lỗi phiên chạy.", session);
    this.server.emit("server:runtime-updated", {
      event: "ERROR",
      machine_code: machine.machine_code,
      data: session
    });
    return response;
  }

  private requireMachine(client: Socket) {
    const machine = this.getSocketData(client).machine;
    if (!machine) {
      throw new WsException({
        success: false,
        code: "RUNTIME_HELLO_REQUIRED",
        message: "Cần gửi machine:hello trước các sự kiện phiên chạy."
      });
    }

    return machine;
  }

  private getSocketData(client: Socket) {
    return client.data as RuntimeSocketData;
  }

  private getClientIp(client: Socket) {
    return getClientIp({
      headers: client.handshake.headers as Record<string, string | string[] | undefined>,
      ip: client.handshake.address,
      socket: {
        remoteAddress: client.conn.remoteAddress
      }
    });
  }

  private ok(code: string, message: string, data: unknown) {
    return {
      success: true,
      code,
      message,
      data
    };
  }
}
