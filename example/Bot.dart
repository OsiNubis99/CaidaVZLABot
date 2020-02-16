// Dart imports
import 'dart:io' as io;

//  Bot imports
import 'package:teledart/teledart.dart';
import 'package:teledart/telegram.dart';
import 'package:teledart/model.dart';

// Bot Api Example
void main(List<String> args) {
  // final envVars = io.Platform.environment;
  if (args.isEmpty) {
    print('Es Ncesario El Bot Token!\n'
        'You can create a runBot.sh file whit your token.');
    io.exit(0);
  }
  final token = args[0];

  var teledart = TeleDart(Telegram(token), Event());

  // TeleDart uses longpull by default.
  teledart.start().then((me) => print('${me.username} is initialised'));

  // In case you decided to use webhook.
  // teledart.setupWebhook(envVars['HOST_URL'], envVars['BOT_TOKEN'],
  //     io.File(envVars['CERT_PATH']), io.File(envVars['KEY_PATH']),
  //     port: int.parse(envVars['BOT_PORT']));
  // teledart
  //     .start(webhook: true)
  //     .then((me) => print('${me.username} is initialised'));

  // You can listen to messages like this
  teledart.onMessage(entityType: 'bot_command', keyword: 'start').listen(
      (message) =>
          teledart.telegram.sendMessage(message.chat.id, 'Hello TeleDart!'));

  // Or usinging short cuts
  teledart
      .onCommand('short')
      .listen(((message) => teledart.replyMessage(message, 'This works too!')));

  // You can even filter streams with stream processinging methods
  // See: https://www.dartlang.org/tutorials/language/streams#methods-that-modify-a-stream
  teledart
      .onMessage(keyword: 'dart')
      .where((message) => message.text.contains('telegram'))
      .listen((message) => teledart.replyPhoto(
          message,
          //  io.File('example/dash_paper_plane.png'),
          'https://raw.githubusercontent.com/DinoLeung/TeleDart/master/example/dash_paper_plane.png',
          caption: 'This is how Dash found the paper plane'));

  // Inline mode.
  teledart
      .onInlineQuery()
      .listen((inlineQuery) => teledart.answerInlineQuery(inlineQuery, [
            InlineQueryResultArticle()
              ..id = 'ping'
              ..title = 'ping'
              ..input_message_content = (InputTextMessageContent()
                ..message_text = '*pong*'
                ..parse_mode = 'MarkdownV2'),
            InlineQueryResultArticle()
              ..id = 'ding'
              ..title = 'ding'
              ..input_message_content = (InputTextMessageContent()
                ..message_text = '_dong_'
                ..parse_mode = 'MarkdownV2')
          ]));
}
