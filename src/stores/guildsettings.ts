import { ClusterClient, Command, GatewayClientEvents } from 'detritus-client';
import { EventSubscription } from 'detritus-utils';

import { Store } from './store';

import { fetchGuildSettings } from '../api';
import { RedisChannels } from '../constants';
import { RedisSpewer } from '../redis';


export interface GuildBlacklist {
  added: string,
  id: string,
  type: string,
  user_id: string,
}

export interface GuildDisabledCommand {
  added: string,
  command: string,
  id: string,
  type: string,
  user_id: string,
}

export interface GuildPrefix {
  added: string,
  guild_id: string,
  prefix: string,
  user_id: string,
}

export interface GuildSettingsStored {
  blacklist: Array<GuildBlacklist>,
  disabled_commands: Array<GuildDisabledCommand>,
  icon: null | string,
  id: string,
  name: string,
  prefixes: Array<GuildPrefix>,
}

// Stores guild settings
class GuildSettings extends Store<string, GuildSettingsStored> {
  constructor() {
    // 2 hours
    super({expire: 2 * (60 * (60 * 1000))});
  }

  insert(payload: GuildSettingsStored): void {
    this.set(payload.id, payload);
  }

  async getOrFetch(context: Command.Context, guildId: string): Promise<GuildSettingsStored | null> {
    let settings: GuildSettingsStored | null = null;
    if (GuildSettingsPromisesStore.has(guildId)) {
      const promise = <GuildSettingsPromise> GuildSettingsPromisesStore.get(guildId);
      settings = await promise;
    } else {
      if (this.has(guildId)) {
        settings = <GuildSettingsStored> this.get(guildId);
      } else {
        const promise: GuildSettingsPromise = new Promise(async (resolve) => {
          try {
            const settings: GuildSettingsStored = await fetchGuildSettings(context, guildId);
            this.set(guildId, settings);
            resolve(settings);
          } catch(error) {
            resolve(null);
          }
          GuildSettingsPromisesStore.delete(guildId);
        });
        GuildSettingsPromisesStore.set(guildId, promise);
        settings = await promise;
      }
    }
    return settings;
  }

  create(cluster: ClusterClient, redis: RedisSpewer) {
    const subscriptions: Array<EventSubscription> = [];
    {
      const subscription = cluster.subscribe('guildDelete', (event: GatewayClientEvents.GuildDelete) => {
        const { guildId } = event;
        this.delete(guildId);
      });
      subscriptions.push(subscription);
    }
    {
      const subscription = redis.subscribe(RedisChannels.GUILD_BLACKLIST_UPDATE, (payload: {blacklist: Array<GuildBlacklist>, id: string}) => {
        if (this.has(payload.id)) {
          const settings = <GuildSettingsStored> this.get(payload.id);
          Object.assign(settings, payload);
        }
      });
      subscriptions.push(subscription);
    }
    {
      const subscription = redis.subscribe(RedisChannels.GUILD_DISABLED_COMMAND_UPDATE, (payload: {disabled_commands: Array<GuildDisabledCommand>, id: string}) => {
        if (this.has(payload.id)) {
          const settings = <GuildSettingsStored> this.get(payload.id);
          Object.assign(settings, payload);
        }
      });
      subscriptions.push(subscription);
    }
    {
      const subscription = redis.subscribe(RedisChannels.GUILD_PREFIX_UPDATE, (payload: {id: string, prefixes: Array<GuildPrefix>}) => {
        if (this.has(payload.id)) {
          const settings = <GuildSettingsStored> this.get(payload.id);
          Object.assign(settings, payload);
        }
      });
      subscriptions.push(subscription);
    }
    {
      const subscription = redis.subscribe(RedisChannels.GUILD_SETTINGS_UPDATE, (payload: GuildSettingsStored) => {
        if (this.has(payload.id)) {
          this.insert(payload);
        }
      });
      subscriptions.push(subscription);
    }
    return subscriptions;
  }
}

export default new GuildSettings();



export type GuildSettingsPromise = Promise<GuildSettingsStored | null>;

class GuildSettingsPromises extends Store<string, GuildSettingsPromise> {
  insert(guildId: string, promise: GuildSettingsPromise): void {
    this.set(guildId, promise);
  }
}

export const GuildSettingsPromisesStore = new GuildSettingsPromises();
