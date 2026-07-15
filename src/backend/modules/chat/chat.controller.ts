import { Controller, Get, Body, Post } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { ChatGateway } from "./chat.gateway";
import { getDeterministicUuid } from "../../../../server/utils/db-helpers";

@Controller("api/chats")
export class ChatController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  async getChats() {
    try {
      const rawMessages = await this.prisma.message.findMany({
        orderBy: { timestamp: "asc" },
        include: { conversation: true }
      });
      return rawMessages.map(msg => ({
        id: msg.id,
        adId: msg.conversation.adId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        text: msg.text,
        timestamp: msg.timestamp ? msg.timestamp.toISOString() : new Date().toISOString(),
        read: msg.read
      }));
    } catch (e) {
      console.error("Error fetching chats", e);
      return [];
    }
  }

  @Post()
  async createMessage(@Body() body: { adId: string; senderId: string; receiverId: string; text: string }) {
    try {
      const adUuid = getDeterministicUuid(body.adId);
      const senderUuid = getDeterministicUuid(body.senderId);
      const receiverUuid = getDeterministicUuid(body.receiverId);

      const [participantOne, participantTwo] = [senderUuid, receiverUuid].sort();

      let conversation = await this.prisma.conversation.findUnique({
        where: {
          adId_participantOne_participantTwo: {
            adId: adUuid,
            participantOne,
            participantTwo
          }
        }
      });

      if (!conversation) {
        conversation = await this.prisma.conversation.create({
          data: {
            adId: adUuid,
            participantOne,
            participantTwo
          }
        });
      }

      const savedMsg = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: senderUuid,
          receiverId: receiverUuid,
          text: body.text,
        },
        include: { conversation: true }
      });

      const formatted = {
        id: savedMsg.id,
        adId: savedMsg.conversation.adId,
        senderId: savedMsg.senderId,
        receiverId: savedMsg.receiverId,
        text: savedMsg.text,
        timestamp: savedMsg.timestamp ? savedMsg.timestamp.toISOString() : new Date().toISOString(),
        read: savedMsg.read
      };

      if (this.chatGateway && this.chatGateway.server) {
        this.chatGateway.server.to(body.receiverId).emit("new-message", formatted);
        this.chatGateway.server.to(body.senderId).emit("new-message", formatted);
      }

      return formatted;
    } catch (e) {
      console.error("Error creating chat message", e);
      throw e;
    }
  }
}
