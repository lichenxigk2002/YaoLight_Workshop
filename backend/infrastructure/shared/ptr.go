package shared

// Ptr 返回传入值的指针
func Ptr[T any](v T) *T {
	return &v
}
