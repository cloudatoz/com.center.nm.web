import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { loginAdmin } from '@/services/apis/auth-api'
import { useAuthStore } from '@/stores/auth-store'

const loginFormSchema = z.object({
  email: z.string().email('Enter a valid admin email address'),
  password: z.string().min(1, 'Password is required'),
})

export function useLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setSession = useAuthStore((state) => state.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const completeLogin = (session: Awaited<ReturnType<typeof loginAdmin>>) => {
    setSession(session)
    queryClient.clear()
    toast.success('Welcome back, Admin')
    navigate('/dashboard', { replace: true })
  }

  const loginMutation = useMutation({
    mutationFn: () => loginAdmin(email.trim().toLowerCase(), password),
    onSuccess: completeLogin,
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Login failed'),
  })

  const submit = () => {
    const parsed = loginFormSchema.safeParse({ email, password })
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      )
      return
    }
    setErrors({})
    loginMutation.mutate()
  }

  return {
    email,
    errors,
    loginMutation,
    password,
    setEmail,
    setPassword,
    setShowPassword,
    showPassword,
    submit,
  }
}
