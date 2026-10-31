// Real-Time LAN & Local Network Multiplayer Manager for BASTION
import type { UnitClass, PlayerId } from '../types/game';

export interface LANInfo {
  lanIp: string;
  lanUrl: string;
}

export type NetworkMessageHandler = (msg: any) => void;

class NetworkManager {
  private ws: WebSocket | null = null;
  private bc: BroadcastChannel | null = null;
  private handlers: Set<NetworkMessageHandler> = new Set();
  public role: PlayerId = 'p1';
  public roomCode: string = '';
  public isConnected: boolean = false;
  public lanUrl: string = window.location.origin;

  constructor() {
    try {
      this.bc = new BroadcastChannel('bastion_lan_fallback');
      this.bc.onmessage = (event) => {
        this.dispatchMessage(event.data);
      };
    } catch {
      // BroadcastChannel not available in old environments
    }

    this.fetchLANInfo();
  }

  public async fetchLANInfo(): Promise<LANInfo> {
    try {
      const host = window.location.hostname || 'localhost';
      const res = await fetch(`http://${host}:8080/api/lan-info`);
      if (res.ok) {
        const data = await res.json();
        this.lanUrl = data.lanUrl;
        return data;
      }
    } catch {
      // Fallback to window origin
    }
    return {
      lanIp: window.location.hostname || '127.0.0.1',
      lanUrl: `${window.location.protocol}//${window.location.host}`,
    };
  }

  public connect(roomCode: string, isHost: boolean) {
    this.roomCode = roomCode;
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8080`;

    try {
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send({
          type: 'JOIN_ROOM',
          roomCode,
          isHost,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'JOINED_SUCCESS') {
            this.role = msg.role;
          }
          this.dispatchMessage(msg);
        } catch (e) {
          console.error('[Network Error]', e);
        }
      };

      this.ws.onerror = () => {
        // Fallback to BroadcastChannel if running on same device across tabs
        this.useLocalFallback(roomCode, isHost);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch {
      this.useLocalFallback(roomCode, isHost);
    }
  }

  private useLocalFallback(roomCode: string, isHost: boolean) {
    this.role = isHost ? 'p1' : 'p2';
    this.isConnected = true;
    setTimeout(() => {
      this.dispatchMessage({
        type: 'JOINED_SUCCESS',
        role: this.role,
        roomCode,
      });

      if (!isHost) {
        this.sendLocal({
          type: 'LOCAL_PEER_CONNECTED',
          roomCode,
        });
      }
    }, 100);
  }

  public subscribe(handler: NetworkMessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private dispatchMessage(msg: any) {
    if (msg.type === 'LOCAL_PEER_CONNECTED' && this.role === 'p1') {
      this.sendLocal({
        type: 'MATCH_START',
        roomCode: this.roomCode,
        p1Name: 'Commander 1 (Host)',
        p2Name: 'Commander 2 (LAN)',
      });
      return;
    }

    for (const h of this.handlers) {
      try {
        h(msg);
      } catch (e) {
        console.error('Handler error:', e);
      }
    }
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.sendLocal(msg);
    }
  }

  private sendLocal(msg: any) {
    if (this.bc) {
      this.bc.postMessage(msg);
    }
  }

  // Tactical Gameplay Action Senders
  public lockArmy(army: UnitClass[]) {
    this.send({
      type: 'LOCK_ARMY',
      army,
      role: this.role,
    });
  }

  public deployUnit(unitClass: UnitClass, x: number, y: number) {
    this.send({
      type: 'DEPLOY_UNIT',
      unitClass,
      x,
      y,
      role: this.role,
    });
  }

  public sendUnitCommand(command: any) {
    this.send({
      type: 'UNIT_COMMAND',
      command,
      role: this.role,
    });
  }

  public requestRematch() {
    this.send({
      type: 'REMATCH_VOTE',
      role: this.role,
    });
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const networkManager = new NetworkManager();
