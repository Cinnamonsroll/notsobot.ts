import { Command, CommandClient } from 'detritus-client';

import { imageDeepfryGif } from '../../api';
import { CommandTypes } from '../../constants';
import { imageReply } from '../../utils';

import { BaseImageCommand } from '../basecommand';


export interface CommandArgsBefore {
  scale?: number,
  url?: null | string,
}

export interface CommandArgs {
  scale?: number,
  url: string,
}

export const COMMAND_NAME = 'deepfry gif';

export default class DeepfryGifCommand extends BaseImageCommand<CommandArgs> {
  constructor(client: CommandClient) {
    super(client, {
      name: COMMAND_NAME,

      args: [
        {aliases: ['s'], name: 'scale', type: 'float'},
      ],
      metadata: {
        description: 'Deep fry an animated image',
        examples: [
          COMMAND_NAME,
          `${COMMAND_NAME} notsobot`,
          `${COMMAND_NAME} notsobot -scale 5`,
        ],
        type: CommandTypes.IMAGE,
        usage: `${COMMAND_NAME} ?<emoji,user:id|mention|name,url> (-scale <float>)`,
      },
    });
  }

  async run(context: Command.Context, args: CommandArgs) {
    const response = await imageDeepfryGif(context, args);
    return imageReply(context, response);
  }
}
