[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]



<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/OsiNubis99/CaidaVZLABot">
    <img src="https://telegram.org/img/t_logo.svg" alt="Logo" width="80" height="80">
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
<details open="open">
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Deployment</a></li>
      </ul>
    </li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgements">Acknowledgements</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

There are many great README templates available on GitHub, however, I didn't find one that really suit my needs so I created this enhanced one. I want to create a README template so amazing that it'll be the last one you ever need -- I think this is it.

Here's why:
* Your time should be focused on creating something amazing. A project that solves a problem and helps others
* You shouldn't be doing the same tasks over and over like creating a README from scratch
* You should element DRY principles to the rest of your life :smile:

Of course, no one template will serve all projects since your needs may be different. So I'll be adding more in the near future. You may also suggest changes by forking this repo and creating a pull request or opening an issue. Thanks to all the people have have contributed to expanding this template!

A list of commonly used resources that I find helpful are listed in the acknowledgements.

### Built With

#### Dependencies
* [pg](https://www.npmjs.com/package/pg)
* [express](https://www.npmjs.com/package/express)
* [node-telegram-bot-api](https://www.npmjs.com/package/node-telegram-bot-api)
* [node-telegram-keyboard-wrapper](https://www.npmjs.com/package/node-telegram-keyboard-wrapper)

#### Dev Dependencies
* [dotenv](https://www.npmjs.com/package/dotenv)
* [nodemon](https://www.npmjs.com/package/nodemon)



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
4. And run ```sh
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

OsiNubis99 - [@OsiNubis](https://t.me/OsiNubis99) - AHurtado.WC@gmail.com

Project Link: [https://github.com/OsiNubis99/CaidaVZLABot](https://github.com/OsiNubis99/CaidaVZLABot)

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/othneildrew/Best-README-Template.svg?style=for-the-badge
[contributors-url]: https://github.com/OsiNubis99/CaidaVZLABot/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/othneildrew/Best-README-Template.svg?style=for-the-badge
[forks-url]: https://github.com/OsiNubis99/CaidaVZLABot/network/members
[stars-shield]: https://img.shields.io/github/stars/othneildrew/Best-README-Template.svg?style=for-the-badge
[stars-url]: https://github.com/OsiNubis99/CaidaVZLABot/stargazers
[issues-shield]: https://img.shields.io/github/issues/othneildrew/Best-README-Template.svg?style=for-the-badge
[issues-url]: https://github.com/OsiNubis99/CaidaVZLABot/issues
[license-shield]: https://img.shields.io/github/license/othneildrew/Best-README-Template.svg?style=for-the-badge
[license-url]: https://github.com/OsiNubis99/CaidaVZLABot/blob/master/LICENSE.txt
[product-screenshot]: https://telegram.org/img/t_logo.svg?1