import { bootstrap as bootstrapFn, mount as mountFn, unmount as unmountFn, update as updateFn } from './main'

export async function bootstrap() {
  // @ts-ignore
  return await bootstrapFn?.()
}

export async function mount(props) {
  // @ts-ignore
  return await mountFn?.(props)
}

export async function unmount(props) {
  // @ts-ignore
  return await unmountFn?.(props)
}

export async function update(props) {
  // @ts-ignore
  return await updateFn?.(props)
}
