# 更新日志 / Changelog

## [3.0.4] - 2025-10-12

### 改进 / Improvements

- **API认证方式更新**: 根据Zabbix官方文档建议，将API认证方式从请求体中的`auth`属性改为使用`Authorization: Bearer <token>`头部认证
  - **API Authentication Update**: Following Zabbix official documentation recommendations, changed API authentication from `auth` property in request body to `Authorization: Bearer <token>` header authentication
  
- **符合最新标准**: 使用Zabbix 7.0+推荐的认证方式，提高安全性和兼容性
  - **Latest Standards Compliance**: Uses Zabbix 7.0+ recommended authentication method for improved security and compatibility

### 技术细节 / Technical Details

- 修改了`js/api.js`中的`ZabbixAPI`类的`request`方法
- 移除了请求体中的`auth`属性
- 添加了`Authorization`头部用于API认证
- 保持了向后兼容性，不影响现有配置

### 参考文档 / Reference

- [Zabbix API Documentation - Authorization methods](https://www.zabbix.com/documentation/7.0/en/manual/api)
