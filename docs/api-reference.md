# API Reference

## Enums

### `AICapability`

Routing capability enum:

- `Chat`
- `Text`
- `Speech`
- `Image`
- `Video`
- `Balance`

## Core Interfaces

### `AIPlatform`

Contract for runtime adapters:

- `chatWithAI(userId, input, context, model)`
- `synthesizeSpeech(userId, input, voice, context, model)`
- `transcribeSpeech(userId, input, context, model)`
- `generateImage(userId, input, context, model)`
- `produceVideo(userId, input, image, context, model)`
- `checkBalance(userId)`
- `currentBalance`

Optional:

- `canHandle(userId, capabilities)`

## Completion Models

Base type:

- `Completion`
  - `id`
  - `partitionKey`
  - `type`
  - `model`
  - `durationMs`
  - `createdAt`
  - `usage?`

Specialized variants:

- `ChatCompletion`
- `TextCompletion`
- `ImageCompletion`
- `SpeechCompletion`
- `VideoCompletion`
- `BalanceCompletion`

## Exported Schemas

- `completionSchema`
- `chatCompletionSchema`
- `textCompletionSchema`
- `imageCompletionSchema`
- `speechCompletionSchema`
- `videoCompletionSchema`
- `balanceCompletionSchema`
