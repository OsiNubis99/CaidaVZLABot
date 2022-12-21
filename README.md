[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT PRESENTATION -->
<br />
<p align="center">
  <a href="https://github.com/OsiNubis99/CaidaVZLABot">
    <img src="docs/images/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Caida game Telegram bot</h3>

  <p align="center">
    a simple bot for the Venezuelan game Caída
    <br />
    <a href="https://t.me/JuegosVZLA">View Demo</a>
    ·
    <a href="https://github.com/OsiNubis99/CaidaVZLABot/issues">Report Bug</a>
    ·
    <a href="https://github.com/OsiNubis99/CaidaVZLABot/issues">Request Feature</a>
  </p>
</p>

<!-- TABLE OF CONTENTS -->

- [Built With](#built-with)
  - [Dependencies](#dependencies)
  - [Dev Dependencies](#dev-dependencies)
- [Usage](#usage)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Deployment](#deployment)
    - [Heroku(Recomended)](#herokurecomended)
    - [Local](#local)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
  - [Social medias](#social-medias)
  - [Email](#email)
- [Acknowledgements](#acknowledgements)

<!-- ABOUT THE PROJECT -->

## Built With

### Dependencies

- [pg](https://www.npmjs.com/package/pg)
- [express](https://www.npmjs.com/package/express)
- [node-telegram-bot-api](https://www.npmjs.com/package/node-telegram-bot-api)
- [node-telegram-keyboard-wrapper](https://www.npmjs.com/package/node-telegram-keyboard-wrapper)

### Dev Dependencies

- [dotenv](https://www.npmjs.com/package/dotenv)
- [nodemon](https://www.npmjs.com/package/nodemon)

<!-- USAGE EXAMPLES -->

## Usage

If you want to play we have a [Telegram group](https://t.me/JuegosVZLA) where you are welcome. However you can clone it and implement your own CaidaBot <a href="#getting-started">(see Getting Started)</a>

<!-- GETTING STARTED -->

## Getting Started

### Prerequisites

1. You need Node and npm to run this bot. We recomend create a HerokuApp.
2. You need a PostgresSQL Database. HerokuApp have a free PostgresSQL database.
3. you need your own Telegram Bot.

### Deployment

#### Heroku(Recomended)

1. Create your own Telegram Bot [Official Telegram Documentation](https://core.telegram.org/bots#3-how-do-i-create-a-bot)
2. Create your HerokuApp and add a Free PostgresSQL database [Official Heroku Website](https://www.heroku.com/)
3. Add all Environment Vars to your HerokuApp [Official Heroku Documentation](https://devcenter.heroku.com/articles/config-vars#using-the-heroku-dashboard). See the .env.example file

#### Local

2. Store your 'TELEGRAM_TOKEN' in the .env file to run locale.
3. Create a PostgresSQL Database and store this url in 'HEROKU_POSTGRESQL_URL' also in the .env file
4. And run

   ```sh
   npm i && npm start
   ```

<!-- ROADMAP -->

## Roadmap

See the [open issues](https://github.com/OsiNubis99/CaidaVZLABot/issues) for a list of proposed features (and known issues).

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- CONTACT -->

## Contact

### Social medias

[![Telegram](https://www.vectorlogo.zone/logos/telegram/telegram-icon.svg)](https://t.me/OsiNubis99)
[![Vue](https://www.vectorlogo.zone/logos/twitter/twitter-icon.svg)](https://twitter.com/OsiNubis99)

### Email

My email address OsiNubis99@PM.me

<!-- ACKNOWLEDGEMENTS -->

## Acknowledgements

- Logo made by [Toweraki](https://t.me/toweraki)

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/OsiNubis99/CaidaVZLABot.svg?style=for-the-badge
[contributors-url]: https://github.com/OsiNubis99/CaidaVZLABot/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/OsiNubis99/CaidaVZLABot.svg?style=for-the-badge
[forks-url]: https://github.com/OsiNubis99/CaidaVZLABot/network/members
[stars-shield]: https://img.shields.io/github/stars/OsiNubis99/CaidaVZLABot.svg?style=for-the-badge
[stars-url]: https://github.com/OsiNubis99/CaidaVZLABot/stargazers
[issues-shield]: https://img.shields.io/github/issues/OsiNubis99/CaidaVZLABot.svg?style=for-the-badge
[issues-url]: https://github.com/OsiNubis99/CaidaVZLABot/issues
[license-shield]: https://img.shields.io/github/license/OsiNubis99/CaidaVZLABot.svg?style=for-the-badge
[license-url]: https://github.com/OsiNubis99/CaidaVZLABot/blob/master/LICENSE.txt
