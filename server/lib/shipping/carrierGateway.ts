/**
 * carrierGateway.ts — Carrier Gateway (Adapter Pattern)
 *
 * Provides a unified interface for external shipping carriers (Aramex, SMSA, DHL, local).
 * Adding a new shipping provider only requires implementing the ICarrierAdapter interface.
 */

import { logger } from '../logger.ts';

// ─── Standardised Interface Types ─────────────────────────────────────────────
export interface ShipmentRequest {
  shipmentId:    string;
  shipperName:   string;
  shipperPhone:  string;
  shipperEmail:  string;
  shipperCity:   string;
  shipperAddress: string;
  recipientName:  string;
  recipientPhone: string;
  recipientEmail: string;
  recipientCity:  string;
  recipientAddress: string;
  weightKg:       number;
  codAmount:      number;
  isCOD:          boolean;
}

export interface ShipmentResponse {
  success:        boolean;
  trackingNumber: string;
  labelUrl?:      string;
  fee:            number;
  rawResponse?:   unknown;
  error?:         string;
}

export interface TrackingDetails {
  status:       string;
  description:  string;
  location?:    string;
  timestamp:    Date;
  rawEvents?:   unknown;
}

export interface ShippingFeeRequest {
  fromCity:  string;
  toCity:    string;
  weightKg:  number;
  isCOD:     boolean;
  codAmount: number;
}

export interface ShippingFeeResponse {
  baseFee:    number;
  codFee:     number;
  totalFee:   number;
}

// ─── Unified Interface ────────────────────────────────────────────────────────
export interface ICarrierAdapter {
  createShipment(request: ShipmentRequest): Promise<ShipmentResponse>;
  trackShipment(trackingNumber: string): Promise<TrackingDetails[]>;
  calculateFees(request: ShippingFeeRequest): Promise<ShippingFeeResponse>;
}

// ─── Aramex Adapter ───────────────────────────────────────────────────────────
export class AramexAdapter implements ICarrierAdapter {
  constructor(private config: { apiUrl: string; accountNo: string; apiKey?: string }) {}

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    logger.info({ message: '[Aramex] Creating shipment', shipmentId: request.shipmentId });
    try {
      // In production, make the real SOAP/JSON request to Aramex API
      // For this spec, we mock the network integration cleanly.
      const mockTrackingNo = `ARM${Date.now()}`;
      return {
        success:        true,
        trackingNumber: mockTrackingNo,
        labelUrl:       `${this.config.apiUrl}/labels/${mockTrackingNo}.pdf`,
        fee:            15.0, // calculated fee from Aramex
      };
    } catch (err: any) {
      logger.error({ message: '[Aramex] Failed to create shipment', error: err.message });
      return { success: false, trackingNumber: '', error: err.message, fee: 0 };
    }
  }

  async trackShipment(trackingNumber: string): Promise<TrackingDetails[]> {
    logger.info({ message: '[Aramex] Tracking shipment', trackingNumber });
    return [
      { status: 'PENDING', description: 'Shipment info received by Aramex', timestamp: new Date(Date.now() - 3600000) },
      { status: 'IN_TRANSIT', description: 'Aramex picked up package', location: 'Sana\'a Main Office', timestamp: new Date() },
    ];
  }

  async calculateFees(request: ShippingFeeRequest): Promise<ShippingFeeResponse> {
    const baseFee = 12.0;
    const codFee = request.isCOD ? 3.0 : 0.0;
    return {
      baseFee,
      codFee,
      totalFee: baseFee + codFee,
    };
  }
}

// ─── SMSA Adapter ─────────────────────────────────────────────────────────────
export class SmsaAdapter implements ICarrierAdapter {
  constructor(private config: { apiUrl: string; apiKey: string }) {}

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    logger.info({ message: '[SMSA] Creating shipment', shipmentId: request.shipmentId });
    try {
      const mockTrackingNo = `SMSA${Date.now()}`;
      return {
        success:        true,
        trackingNumber: mockTrackingNo,
        labelUrl:       `https://smsaexpress.com/track/${mockTrackingNo}`,
        fee:            18.0,
      };
    } catch (err: any) {
      return { success: false, trackingNumber: '', error: err.message, fee: 0 };
    }
  }

  async trackShipment(trackingNumber: string): Promise<TrackingDetails[]> {
    return [
      { status: 'PICKED_UP', description: 'In transit to destination', location: 'Aden Sorting Center', timestamp: new Date() },
    ];
  }

  async calculateFees(request: ShippingFeeRequest): Promise<ShippingFeeResponse> {
    const baseFee = 15.0;
    const codFee = request.isCOD ? 4.0 : 0.0;
    return {
      baseFee,
      codFee,
      totalFee: baseFee + codFee,
    };
  }
}

// ─── Local Carrier Adapter (Souq/Aswaq Network Partner) ────────────────────────
export class LocalCarrierAdapter implements ICarrierAdapter {
  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    logger.info({ message: '[LocalCarrier] Creating shipment', shipmentId: request.shipmentId });
    const mockTrackingNo = `LOC${Date.now()}`;
    return {
      success:        true,
      trackingNumber: mockTrackingNo,
      fee:            5.0,
    };
  }

  async trackShipment(trackingNumber: string): Promise<TrackingDetails[]> {
    return [
      { status: 'WAITING_PICKUP', description: 'Local courier partner dispatched', timestamp: new Date() },
    ];
  }

  async calculateFees(request: ShippingFeeRequest): Promise<ShippingFeeResponse> {
    return {
      baseFee:  5.0,
      codFee:   request.isCOD ? 1.0 : 0.0,
      totalFee: request.isCOD ? 6.0 : 5.0,
    };
  }
}

// ─── Gateway Router/Registry ──────────────────────────────────────────────────
export class CarrierGateway {
  private static adapters = new Map<string, ICarrierAdapter>();

  static register(carrierKey: string, adapter: ICarrierAdapter) {
    this.adapters.set(carrierKey.toLowerCase(), adapter);
    logger.info({ message: `[CarrierGateway] Registered adapter for ${carrierKey}` });
  }

  static get(carrierKey: string): ICarrierAdapter {
    const adapter = this.adapters.get(carrierKey.toLowerCase());
    if (!adapter) {
      throw new Error(`No carrier adapter registered for key: ${carrierKey}`);
    }
    return adapter;
  }
}
