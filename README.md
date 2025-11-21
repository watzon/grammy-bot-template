# Grammy Drizzle Bun Template

A modern Telegram bot template built with Grammy, Drizzle ORM, and Bun. This template provides a solid foundation for building scalable Telegram bots with TypeScript, database integration, and modern development tooling.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd grammy-bot-template
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   bun db:generate
   bun db:migrate
   ```

5. **Start the bot**
   ```bash
   bun dev
   ```

## Usage

### Development

Start the bot in development mode with hot reload:
```bash
bun dev
```

### Production

Start the bot in production mode:
```bash
bun start
```

### Database Management

Generate database migrations:
```bash
bun db:generate
```

Run database migrations:
```bash
bun db:migrate
```

Open Drizzle Studio for database management:
```bash
bun db:studio
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Telegram Bot Token (required)
BOT_TOKEN=your_telegram_bot_token_here

# Database URL (required)
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### Getting a Bot Token

1. Start a chat with [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the bot token provided by BotFather

## Database Setup

This template uses PostgreSQL with Drizzle ORM. Follow these steps to set up your database:

### 1. Create a PostgreSQL Database

```sql
CREATE DATABASE your_bot_db;
```

### 2. Set Database URL

Update your `.env` file with the database connection string:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/your_bot_db
```

### 3. Generate and Run Migrations

```bash
# Generate migration files from schema
bun db:generate

# Run migrations to create tables
bun db:migrate
```

### 4. Modify Database Schema

Edit `src/db/schema.ts` to define your database tables. After making changes:

```bash
bun db:generate  # Generate new migration
bun db:migrate    # Apply the migration
```

## Available Scripts

- `bun dev` - Start the bot in development mode with hot reload
- `bun start` - Start the bot in production mode
- `bun lint` - Lint the codebase with Biome
- `bun fmt` - Format the code with Biome
- `bun typecheck` - Run TypeScript type checking
- `bun test` - Run tests
- `bun check` - Run linting, type checking, and tests
- `bun db:generate` - Generate database migrations
- `bun db:migrate` - Run database migrations
- `bun db:studio` - Open Drizzle Studio for database management

## Project Structure

```
├── src/
│   ├── bot.ts              # Bot creation and configuration
│   ├── commands/           # Bot command handlers
│   │   └── start.ts        # /start command implementation
│   ├── config.ts           # Configuration and environment validation
│   ├── db/                 # Database configuration and schema
│   │   ├── index.ts        # Database connection setup
│   │   └── schema.ts       # Database schema definitions
│   ├── middleware/         # Bot middleware
│   │   └── logger.ts       # Logging middleware
│   ├── types.ts            # TypeScript type definitions
│   ├── index.ts            # Application entry point
├── drizzle/                # Generated database migrations
├── drizzle.config.ts       # Drizzle configuration
├── package.json            # Dependencies and scripts
├── bun.lockb               # Bun lockfile
├── README.md               # This file
└── .gitignore              # Git ignore file
```

### Adding New Commands

1. Create a new file in `src/commands/` for your command:
   ```typescript
   // src/commands/mycommand.ts
   import { Bot } from "grammy";

   export function myCommand(bot: Bot) {
       bot.command("mycommand", async (ctx) => {
           await ctx.reply("This is my custom command!");
       });
   }
   ```

2. Import and register the command in `src/bot.ts`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the test suite (`bun check`)
5. Commit your changes
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

This project uses [Biome](https://biomejs.dev/) for code formatting and linting. Run `bun fmt` to format code and `bun lint` to check for issues.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you have any questions or run into issues, please open an issue on GitHub.

## Related Projects

- [Grammy](https://grammy.dev/) - Telegram Bot Framework for TypeScript/JavaScript
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM for SQL databases
- [Bun](https://bun.sh/) - Fast JavaScript runtime and toolkit