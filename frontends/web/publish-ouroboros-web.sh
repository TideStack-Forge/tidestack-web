#!/bin/bash

# 脚本用于发布 ouroboros-web Docker 镜像
#
# 命令行参数：
# -v 版本号    必填
# -r 仓库地址  选填，默认为 aliyun 镜像仓库
# -n 命名空间  选填，默认为 ouroboros
# -i 镜像名称  选填，默认为 ouroboros-web
# -t 镜像标签  选填，默认为 version,<major_version>-latest,<major_version>.<minor_version>-latest,latest
# -u 发布到仓库的用户名 若当前环境已经登录了 docker 仓库，则不需要提供用户名和密码
# -p 发布到仓库的密码   若当前环境已经登录了 docker 仓库，则不需要提供用户名和密码
# -c 是否清理构建缓存
# -m npm 仓库镜像 选填，默认为当前环境的 npm 配置的仓库
# -l 本地构建镜像，不登录、不推送
# -h 打印帮助信息
#
# 例子：./publish-ouroboros-web.sh -v 1.0.0 -n ouroboros -i ouroboros-web -t latest,1-latest
#
# 注意：
# 1. 目前只提供 shell 脚本，未提供 windows 脚本
# 2. 请确保已经安装了 npm 包管理工具 npm
# 3. 确保已经登录了 docker 仓库，否则需要提供仓库的用户名和密码

# 提取 命令行参数
registry="registry.cn-hangzhou.aliyuncs.com"
namespace="ouroboros"
image_name="ouroboros-web"
clean_cache=false
npm_registry=""
support_multi_arch=false
base_image="nginx:1.28-alpine"
local_build=false

set -e

while getopts "v:r:n:i:t:u:p:m:b:aclh" opt; do
  case $opt in
  v)
    version=$OPTARG
    ;;
  r)
    registry=$OPTARG
    ;;
  n)
    namespace=$OPTARG
    ;;
  i)
    image_name=$OPTARG
    ;;
  t)
    tags=$OPTARG
    ;;
  u)
    username=$OPTARG
    ;;
  p)
    password=$OPTARG
    ;;
  m)
    npm_registry=$OPTARG
    ;;
  b)
    base_image=$OPTARG
    ;;
  a)
    support_multi_arch=true
    ;;
  c)
    clean_cache=true
    ;;
  l)
    local_build=true
    ;;
  h)
    echo "用法： -v 版本号 [-r 仓库地址] [-n 命名空间] [-i 镜像名称] [-t 镜像标签] [-u 发布到仓库的用户名] [-p 发布到仓库的密码] [-b 基础镜像] [-a 是否发布多架构镜像] [-c 是否清理构建缓存] [-m npm 仓库镜像] [-l 本地构建不推送] [-h 打印帮助信息]"
    echo "参数说明："
    echo "-v <版本号>\t基座版本号，格式为 1.0.0，后面可加预发行版本信息如：1.0.0-alpha.1"
    echo "-r <镜像仓库>\t容器镜像仓库地址 默认为 aliyun 镜镜像"
    echo "-n <命名空间>\t容器镜像的命名空间，默认为 ouroboros"
    echo "-i <镜像名称>\t容器镜像的名称，默认为 ouroboros-web"
    echo "-t <镜像标签>\t容器镜像的标签列表，以逗号分隔，默认为 version,<major_version>-latest,<major_version>.<minor_version>-latest,latest"
    echo "-u <发布用户名>\t可选，若当前环境已经登录了 docker 仓库，则不需要提供用户名和密码"
    echo "-p <密码>\t可选，若当前环境已经登录了 docker 仓库，则不需要提供用户名和密码"
    echo "-b <基础镜像>\t可选，Dockerfile 的 BASE_IMAGE 构建参数，默认为 nginx:1.28-alpine"
    echo "-a \t\t是否发布多架构镜像（默认关闭，开启后发布 linux/amd64,linux/arm64 manifest）"
    echo "-m <npm镜像>\t可选，指定构建前端下载依赖用的npm镜像"
    echo "-l \t\t本地构建镜像，不登录、不推送；会分别 load amd64 和 arm64 标签"
    echo "-c \t\t是否清理Docker构建缓存"
    echo "-h \t\t打印帮助信息"
    exit 0
    ;;
  \?)
    echo "无效的选项：-$OPTARG" >&2
    exit 1
    ;;
  :)
    echo "选项 -$OPTARG 需要参数" >&2
    exit 1
    ;;
  esac
done

if [ -z "$version" ]; then
  echo "版本号不能为空"
  exit 1
fi

# 如果没有指定标签，则生成默认标签
if [ -z "$tags" ]; then
  major=$(echo $version | cut -d '.' -f 1)
  minor=$(echo $version | cut -d '.' -f 2)
  tags="$version,${major}-latest,${major}.${minor}-latest,latest"
fi

echo "准备发布前端基座"
echo "版本号：$version"
echo "镜像仓库：$registry"
echo "命名空间：$namespace"
echo "镜像名称：$image_name"
echo "镜像标签：$tags"
echo "基础镜像：$base_image"
echo "发布多架构镜像：$support_multi_arch"
echo "本地构建不推送：$local_build"
echo "清理构建缓存：$clean_cache"
# 如果指定了 npm 镜像仓库，则显示提示信息
if [ -n "$npm_registry" ]; then
  echo "npm 仓库：$npm_registry"
fi

docker_username=${username:-${DOCKER_USER:-}}
docker_password=${password:-${DOCKER_PASS:-}}

if [ "$local_build" = true ]; then
  echo "本地构建模式，跳过 Docker 登录"
elif [ -z "$docker_username" ] || [ -z "$docker_password" ]; then
  echo "未提供仓库的用户名和密码，将尝试使用当前环境已经登录的账号（若未登录，则无法发布）"
else
  echo "正在登录镜像仓库"
  echo "$docker_password" | docker login --username="$docker_username" --password-stdin "$registry"
fi

NODE_NPM_BASELINE_MODE=presence bash ../../scripts/ci/verify-node-npm-baseline.sh

cd main-app

# 构建前端
echo "正在构建前端"

# 安装依赖
if [ -n "$npm_registry" ]; then
  npm ci --legacy-peer-deps --registry="$npm_registry"
else
  npm ci --legacy-peer-deps
fi
../scripts/apply-amis-ui-tooltip-patch.sh

# 构建前端
npm run build

# 构建镜像
echo "正在构建镜像"

# 准备镜像标签
targets=""
targets_arm64=""
for tag in $(echo "$tags" | tr ',' ' '); do
  targets="$targets -t $registry/$namespace/$image_name:$tag"
  targets_arm64="$targets_arm64 -t $registry/$namespace/$image_name:$tag-arm64"
done

echo "构建多架构目标：$targets"
echo "构建 arm64 兼容目标：$targets_arm64"

if [ "$support_multi_arch" = true ]; then
  if [ "$local_build" = true ]; then
    # buildx --load 不能导入多平台 manifest，本地预检分别构建两个平台标签。
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/amd64 $targets --load .
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/arm64 $targets_arm64 --load .
  else
    # 先推多架构 manifest，供默认标签直接消费
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/amd64,linux/arm64 $targets --push .

    # 再补 arm64 后缀标签，兼容现有 mothership/develop 构建链路
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/arm64 $targets_arm64 --push .
  fi
else
  # 默认与后端镜像链路保持一致：发布 amd64 主标签 + arm64 兼容标签
  if [ "$local_build" = true ]; then
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/amd64 $targets --load .
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/arm64 $targets_arm64 --load .
  else
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/amd64 $targets --push .
    docker buildx build --build-arg BASE_IMAGE="$base_image" --platform linux/arm64 $targets_arm64 --push .
  fi
fi

# 清理构建缓存
if [ "$clean_cache" = true ]; then
  echo "正在清理构建缓存"
  docker builder prune -f
fi

if [ "$local_build" = true ]; then
  echo "本地构建完成"
else
  echo "发布完成"
fi
