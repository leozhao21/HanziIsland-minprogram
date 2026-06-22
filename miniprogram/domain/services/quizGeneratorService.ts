import { HanziCharacter, QuizQuestion, QuizType } from '../models'

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function generateQuestion(
  type: QuizType,
  target: HanziCharacter,
  pool: HanziCharacter[],
): QuizQuestion | null {
  const distractors = shuffle(pool.filter((c) => c.id !== target.id))
    .slice(0, 3)
    .map((c) => c.character)

  if (distractors.length < 3) return null

  switch (type) {
    case QuizType.Recognize: {
      const options = shuffle([...distractors, target.character])
      const correctIndex = options.indexOf(target.character)
      return {
        id: uid(),
        type: QuizType.Recognize,
        target,
        prompt: '听读音，选出正确的字',
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
      }
    }
    case QuizType.ListenPick: {
      const options = shuffle([...distractors, target.character])
      const correctIndex = options.indexOf(target.character)
      return {
        id: uid(),
        type: QuizType.ListenPick,
        target,
        prompt: '听一听，选出听到的字',
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
      }
    }
    case QuizType.SentenceFill: {
      const blanked = target.sentence.replace(target.character, '___')
      const options = shuffle([...distractors, target.character])
      const correctIndex = options.indexOf(target.character)
      return {
        id: uid(),
        type: QuizType.SentenceFill,
        target,
        prompt: blanked,
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        sentenceTemplate: blanked,
      }
    }
  }
}

export function generateMixedSession(
  characters: HanziCharacter[],
  count: number,
  types: QuizType[],
  requiredCharacters: HanziCharacter[] = [],
  distractorPool?: HanziCharacter[],
): QuizQuestion[] {
  if (types.length === 0 || characters.length === 0) return []

  const pool = distractorPool && distractorPool.length >= 4 ? distractorPool : characters
  const questions: QuizQuestion[] = []
  const usedIds = new Set<string>()
  let typeIndex = 0

  for (const char of requiredCharacters) {
    if (!characters.some((c) => c.id === char.id)) continue
    const type = types[typeIndex % types.length]
    typeIndex++
    const q = generateQuestion(type, char, pool)
    if (q) {
      questions.push(q)
      usedIds.add(char.id)
    }
  }

  const remaining = Math.max(0, count - questions.length)
  if (remaining > 0) {
    const extras = shuffle(characters.filter((c) => !usedIds.has(c.id)))
    for (const char of extras.slice(0, remaining)) {
      const type = types[typeIndex % types.length]
      typeIndex++
      const q = generateQuestion(type, char, pool)
      if (q) questions.push(q)
    }
  }

  return shuffle(questions)
}
