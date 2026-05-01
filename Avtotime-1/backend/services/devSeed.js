import bcrypt from 'bcryptjs'
import User from '../models/user.model.js'

const DEV_USERS = [
  { name: 'Владислав', userName: 'neko_punk', email: 'neko_punk@example.com' },
  { name: 'focus FOCUS', userName: 'focussssssss123', email: 'focus@example.com' },
  { name: 'Bercen', userName: 'sasha13', email: 'sasha13@example.com' },
  { name: 'pepe', userName: 'pepe', email: 'pepe@example.com' },
  { name: 'Andriesh', userName: 'Andriesh', email: 'andriesh@example.com' },
  { name: 'Artur', userName: 'Artur12', email: 'artur12@example.com' },
  { name: 'Artur', userName: 'Artur1', email: 'artur1@example.com' },
]

export const ensureDevSeed = async () => {
  const shouldSeed = process.env.MONGO_IN_MEMORY === 'true' && process.env.DEV_SEED !== 'false'
  if (!shouldSeed) return

  const defaultPassword = process.env.DEV_SEED_PASSWORD || '123456'
  const hashedPassword = await bcrypt.hash(defaultPassword, 10)

  for (const devUser of DEV_USERS) {
    const existing = await User.findOne({ userName: devUser.userName })
    if (existing) continue

    await User.create({
      ...devUser,
      password: hashedPassword,
    })
  }

  console.log(`dev seed ensured (${DEV_USERS.length} users, password="${defaultPassword}")`)
}
