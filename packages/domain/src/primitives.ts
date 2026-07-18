export type UUID = string;
export type IsoDateTime = string;

export interface Versioned {
  version: number;
}

export interface WithTimestamps {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OperationRequest {
  operationId: UUID;
}
