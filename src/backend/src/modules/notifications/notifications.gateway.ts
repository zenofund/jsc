import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('NotificationsGateway');

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('Notifications Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth.token || client.handshake.query.token;

      if (!token) {
        this.logger.debug(`Client connected without token: ${client.id}`);
        // Optionally disconnect if strict auth required
        return;
      }

      // Verify token (remove Bearer prefix if present)
      const tokenString = token.replace('Bearer ', '');
      const payload = this.jwtService.verify(tokenString);
      const userId = payload.sub;
      const role = payload.role;

      // Join user to their own room
      client.join(`user:${userId}`);
      
      // Join user to their role room if applicable
      if (role) {
        client.join(`role:${role}`);
      }

      this.logger.log(`Client connected: ${client.id}, User: ${userId}, Role: ${role}`);
    } catch (error) {
      this.logger.error(`Connection unauthorized: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  sendNotification(notification: any) {
    // If recipient is 'all' and role is specified, send to role room
    if (notification.recipient_id === 'all' && notification.recipient_role) {
      this.server.to(`role:${notification.recipient_role}`).emit('notification', notification);
    } 
    // If recipient is specific user
    else if (notification.recipient_id && notification.recipient_id !== 'all') {
      this.server.to(`user:${notification.recipient_id}`).emit('notification', notification);
    }
    // If broadcast to all (no role, recipient_id = 'all')
    else if (notification.recipient_id === 'all') {
      this.server.emit('notification', notification);
    }
  }
}
